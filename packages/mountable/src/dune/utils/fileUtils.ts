// The stlite repo uses webpack 5 that does not have polyfills for node-fetch which
// is used by cognite-sdk. This ended up being quite a bit of work to fix, so we just
// download the files directly using fetch instead.

import {
  ZipReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  FileEntry,
} from "@zip.js/zip.js";

export interface SourceCodeResult {
  [filePath: string]: string;
}

export interface ZipEntry {
  filename: string;
  directory: boolean;
  getData: () => Promise<Uint8Array>;
}

export interface FileContent {
  binaryData: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  lastUpdated?: Date;
}

export interface Credentials {
  token: string;
  project: string;
  baseUrl: string;
}

export interface CogniteFile {
  id: number;
  externalId: string;
  name: string;
  mimeType?: string;
  lastUpdatedTime?: Date;
  createdTime?: Date;
}

export interface CogniteDownloadUrl {
  downloadUrl: string;
}

/**
 * Make authenticated request to Cognite API
 */
const makeCogniteRequest = async (
  url: string,
  credentials: Credentials,
  options: RequestInit = {},
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response;
};

/**
 * Retrieve file metadata from Cognite API
 */
export const retrieveFileMetadata = async (
  externalId: string,
  credentials: Credentials,
): Promise<CogniteFile> => {
  const url = `${credentials.baseUrl}/api/v1/projects/${credentials.project}/files/byids`;

  const response = await makeCogniteRequest(url, credentials, {
    method: "POST",
    body: JSON.stringify({
      items: [{ externalId }],
    }),
  });

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error("Could not retrieve file metadata");
  }

  const file = data.items[0];
  return {
    id: file.id,
    externalId: file.externalId,
    name: file.name,
    mimeType: file.mimeType,
    lastUpdatedTime: file.lastUpdatedTime
      ? new Date(file.lastUpdatedTime)
      : undefined,
    createdTime: file.createdTime ? new Date(file.createdTime) : undefined,
  };
};

/**
 * Get download URL for a file from Cognite API
 */
export const getFileDownloadUrl = async (
  externalId: string,
  credentials: Credentials,
): Promise<CogniteDownloadUrl> => {
  const url = `${credentials.baseUrl}/api/v1/projects/${credentials.project}/files/downloadlink`;

  const response = await makeCogniteRequest(url, credentials, {
    method: "POST",
    body: JSON.stringify({
      items: [{ externalId }],
    }),
  });

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error("Could not get download URL for file");
  }

  return {
    downloadUrl: data.items[0].downloadUrl,
  };
};

/**
 * Check if a file is a ZIP file based on extension or MIME type
 */
export const isZipFile = (fileName: string, mimeType?: string): boolean => {
  return (
    fileName.toLowerCase().endsWith(".zip") ||
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  );
};

/**
 * Default ZIP processor using @zip.js/zip.js
 */
export const defaultGetZipEntries = async (
  binaryData: ArrayBuffer,
): Promise<ZipEntry[]> => {
  const zipReader = new ZipReader(
    new Uint8ArrayReader(new Uint8Array(binaryData)),
  );
  const entries = await zipReader.getEntries();

  // Convert zip.js Entry objects to our simpler ZipEntry interface
  // We filter out directories since we don't need them
  const zipEntries: ZipEntry[] = entries
    .filter((entry) => !entry.directory)
    .map((entry) => ({
      filename: entry.filename,
      directory: false,
      getData: async () => {
        const writer = new Uint8ArrayWriter();
        // This casting with as is correct
        // because of .filter((entry) => !entry.directory)
        // above. Somehow the build system doesn't pick it up.
        return (entry as FileEntry).getData(writer);
      },
    }));

  await zipReader.close();

  return zipEntries;
};

/**
 * Process ZIP file content
 */
export const processZipFile = async (
  binaryData: ArrayBuffer,
  fileName: string,
  getZipEntries: (
    data: ArrayBuffer,
  ) => Promise<ZipEntry[]> = defaultGetZipEntries,
): Promise<SourceCodeResult> => {
  const entries = await getZipEntries(binaryData);
  const result: SourceCodeResult = {};
  const failedFiles: string[] = [];

  const promises: Promise<void>[] = [];

  // Process each file in the zip
  for (const entry of entries) {
    // We don't care about the actual directories in the zip files.
    // Files inside the directories will have their paths in the file name
    // so that is ok.
    if (!entry.directory) {
      const promise = (async () => {
        try {
          // Extract as binary and convert to string for all files
          const content = await entry.getData();
          result[entry.filename] = new TextDecoder().decode(content);
        } catch (error) {
          failedFiles.push(entry.filename);
        }
      })();

      promises.push(promise);
    }
  }

  await Promise.all(promises);

  if (failedFiles.length > 0) {
    throw new Error(
      `Failed to extract ${failedFiles.length} file(s) from ZIP: ${failedFiles.join(", ")}`,
    );
  }

  return result;
};
