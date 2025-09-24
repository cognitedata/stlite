import { useState, useEffect } from "react";
import {
  retrieveFileMetadata,
  getFileDownloadUrl,
  Credentials,
} from "../utils/fileUtils";

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
  appId?: string,
  credentials?: Credentials | null,
) => {
  const [fileContent, setFileContent] = useState<FileContent | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFileContentData = async () => {
      if (!appId || !credentials) {
        setFileContent(undefined);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get file metadata
        const file = await retrieveFileMetadata(appId, credentials);

        // Get download URL
        const { downloadUrl } = await getFileDownloadUrl(appId, credentials);

        // Fetch the file content
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch file content: ${response.statusText}`,
          );
        }
        const binaryData = await response.arrayBuffer();

        if (isMounted) {
          setFileContent({
            binaryData,
            fileName: file.name,
            mimeType: file.mimeType,
            lastUpdated: file.lastUpdatedTime || file.createdTime,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFileContentData();

    return () => {
      isMounted = false;
    };
  }, [appId, credentials]);

  return {
    fileContent,
    isLoading,
    error,
  };
};
