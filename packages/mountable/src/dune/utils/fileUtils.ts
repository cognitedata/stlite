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
  lastUpdatedTime?: number; // API returns milliseconds since the epoch
  createdTime?: number; // API returns milliseconds since the epoch
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
