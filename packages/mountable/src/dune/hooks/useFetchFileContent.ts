import { useState, useEffect } from "react";
import { CogniteClient } from "@cognite/sdk";

export interface FileContent {
  binaryData: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  lastUpdated?: Date;
}

/**
 * Hook to fetch file content from CDF using SDK
 */
export const useFetchFileContent = (
  appId?: string,
  sdk?: CogniteClient | null,
) => {
  const [fileContent, setFileContent] = useState<FileContent | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFileContent = async () => {
      if (!appId || !sdk) {
        setFileContent(undefined);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get file metadata
        const files = await sdk.files.retrieve([{ externalId: appId }]);
        if (!files.length) {
          throw new Error("Could not retrieve file metadata");
        }

        const file = files[0];

        // Get download URL
        const downloadUrls = await sdk.files.getDownloadUrls([
          { externalId: appId },
        ]);

        if (!downloadUrls.length) {
          throw new Error("Could not get download URL for file");
        }

        // Fetch the file content
        const response = await fetch(downloadUrls[0].downloadUrl);
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

    fetchFileContent();

    return () => {
      isMounted = false;
    };
  }, [appId, sdk]);

  return {
    fileContent,
    isLoading,
    error,
  };
};
