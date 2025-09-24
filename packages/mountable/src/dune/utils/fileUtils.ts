// The stlite repo uses webpack 5 that does not have polyfills for node-fetch which
// is used by cognite-sdk. This ended up being quite a bit of work to fix, so we just
// download the files directly using fetch instead.

import type { Entry } from "@zip.js/zip.js";
export interface SourceCodeResult {
  [filePath: string]: string;
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
): Promise<Entry[]> => {
  // Lazy load the zip.js library to avoid Node.js import issues
  const { ZipReader, BlobReader } = await import("@zip.js/zip.js");

  const blob = new Blob([binaryData]);
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries = await zipReader.getEntries();
  await zipReader.close();

  return entries;
};

/**
 * Process ZIP file content
 */
export const processZipFile = async (
  binaryData: ArrayBuffer,
  fileName: string,
  getZipEntries: (data: ArrayBuffer) => Promise<Entry[]> = defaultGetZipEntries,
): Promise<SourceCodeResult> => {
  const entries = await getZipEntries(binaryData);
  const result: SourceCodeResult = {};

  const promises: Promise<void>[] = [];

  // Process each file in the zip
  for (const entry of entries) {
    if (!entry.directory) {
      const promise = (async () => {
        try {
          // Extract as binary and convert to string for all files
          // Lazy load the zip.js library to avoid Node.js import issues
          const { Uint8ArrayWriter } = await import("@zip.js/zip.js");
          const uint8ArrayWriter = new Uint8ArrayWriter();
          const content = await entry.getData(uint8ArrayWriter);
          result[entry.filename] = new TextDecoder().decode(content);
        } catch (error) {
          console.error(`Error extracting file ${entry.filename}:`, error);
        }
      })();

      promises.push(promise);
    }
  }

  await Promise.all(promises);
  return result;
};
