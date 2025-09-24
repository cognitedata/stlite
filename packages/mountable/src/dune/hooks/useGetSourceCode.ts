import { useState, useEffect } from "react";
import {
  parseFileContent,
  type SourceCodeResult,
  type FileContent,
} from "../utils/fileUtils";

/**
 * Hook to parse file content into source code using utility functions
 */
export const useParseFileContent = (fileContent?: FileContent | null) => {
  const [sourceCode, setSourceCode] = useState<SourceCodeResult | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const parseContent = async () => {
      if (!fileContent) {
        setSourceCode(undefined);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await parseFileContent(fileContent);
        if (isMounted) {
          setSourceCode(result);
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

    parseContent();

    return () => {
      isMounted = false;
    };
  }, [fileContent]);

  return {
    sourceCode,
    isLoading,
    error,
  };
};
