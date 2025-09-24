export interface SourceCodeResult {
  [filePath: string]: string;
}

export interface FileContent {
  binaryData: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  lastUpdated?: Date;
}

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
 * Convert ArrayBuffer to string using TextDecoder
 */
export const arrayBufferToString = (buffer: ArrayBuffer): string => {
  return new TextDecoder().decode(buffer);
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
  const content = arrayBufferToString(binaryData);
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
