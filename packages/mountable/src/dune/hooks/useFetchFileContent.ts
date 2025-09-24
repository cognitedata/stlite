import { useState, useEffect } from "react";
import { fetchFileContent, Credentials } from "../utils/fileUtils";

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
        const fileContentData = await fetchFileContent(appId, credentials);

        if (isMounted) {
          setFileContent(fileContentData);
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
