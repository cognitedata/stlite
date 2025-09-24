// The stlite repo uses webpack 5 that does not have polyfills for node-fetch which
// is used by cognite-sdk. This ended up being quite a bit of work to fix, so we just
// download the files directly using fetch instead.

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
 * Process ZIP file content using JSZip - matches original implementation exactly
 */
export const processZipFile = async (
  binaryData: ArrayBuffer,
  fileName: string,
): Promise<SourceCodeResult> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(binaryData);
  const fileSystem = new Map<string, ArrayBuffer | string>();

  // Process each file in the zip
  const promises: Promise<void>[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      // It's a file, not a directory
      const promise = (async () => {
        try {
          const extension = relativePath.split(".").pop()?.toLowerCase() || "";
          const textExtensions = [
            "html",
            "css",
            "js",
            "json",
            "txt",
            "xml",
            "svg",
            "md",
          ];

          if (textExtensions.includes(extension)) {
            // Extract as text for text files
            const content = await zipEntry.async("string");
            fileSystem.set(relativePath, content);
          } else {
            // Extract as binary for other files
            const content = await zipEntry.async("arraybuffer");
            fileSystem.set(relativePath, content);
          }
        } catch (error) {
          console.error(`Error extracting file ${relativePath}:`, error);
        }
      })();

      promises.push(promise);
    }
  });

  await Promise.all(promises);

  // Convert Map to object like the original implementation
  const result: SourceCodeResult = {};
  fileSystem.forEach((content, filePath) => {
    if (typeof content === "string") {
      result[filePath] = content;
    } else {
      // Convert ArrayBuffer to string if needed
      result[filePath] = new TextDecoder().decode(content);
    }
  });

  return result;
};

/**
 * Process regular file content
 */
export const processRegularFile = (
  binaryData: ArrayBuffer,
  fileName: string,
): SourceCodeResult => {
  const content = new TextDecoder().decode(binaryData);
  return {
    [fileName]: content,
  };
};

/**
 * Parse file content into source code result
 */
export const parseFileContent = async (
  fileContent: FileContent,
): Promise<SourceCodeResult> => {
  const { binaryData, fileName, mimeType } = fileContent;

  if (isZipFile(fileName, mimeType)) {
    return await processZipFile(binaryData, fileName);
  } else {
    return processRegularFile(binaryData, fileName);
  }
};
