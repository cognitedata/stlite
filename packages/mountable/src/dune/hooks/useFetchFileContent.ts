import { useState, useEffect } from "react";
import { Credentials } from "../utils/fileUtils";

export interface FileContent {
  binaryData: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  lastUpdated?: Date;
}

/**
 * Hook to fetch file content from CDF using direct API calls
 */
export const useFetchFileContent = (
  retrieveFileMetadataFunction: (
    externalId: string,
    credentials: Credentials,
  ) => Promise<any>,
  getFileDownloadUrlFunction: (
    externalId: string,
    credentials: Credentials,
  ) => Promise<{ downloadUrl: string }>,
  appId?: string,
  credentials?: Credentials | null,
) => {
  const [fileContent, setFileContent] = useState<FileContent | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchFileContentData = async () => {
      if (!appId || !credentials) {
        setFileContent(undefined);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get file metadata
        const file = await retrieveFileMetadataFunction(appId, credentials);

        // Get download URL
        const { downloadUrl } = await getFileDownloadUrlFunction(
          appId,
          credentials,
        );

        // Fetch the file content
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch file content: ${response.statusText}`,
          );
        }
        const binaryData = await response.arrayBuffer();

        if (isActive) {
          setFileContent({
            binaryData,
            fileName: file.name,
            mimeType: file.mimeType,
            lastUpdated: file.lastUpdatedTime || file.createdTime,
          });
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchFileContentData();

    return () => {
      isActive = false;
    };
  }, [
    appId,
    credentials,
    retrieveFileMetadataFunction,
    getFileDownloadUrlFunction,
  ]);

  return {
    fileContent,
    isLoading,
    error,
  };
};
