import {
  retrieveFileMetadata,
  getFileDownloadUrl,
  isZipFile,
  type Credentials,
  processZipFile,
  defaultGetZipEntries,
} from "./fileUtils";

import type { DirectoryEntry, FileEntry } from "@zip.js/zip.js";

// Mock the entire @zip.js/zip.js module to avoid Node.js compatibility issues
jest.mock("@zip.js/zip.js", () => ({
  ZipReader: jest.fn().mockImplementation(() => ({
    getEntries: jest.fn(),
    close: jest.fn(),
  })),
  Uint8ArrayReader: jest.fn(),
  Uint8ArrayWriter: jest.fn().mockImplementation(() => ({})),
}));

describe("fileUtils", () => {
  const mockFetch: typeof fetch = jest.fn();
  const mockCredentials: Credentials = {
    token: "test-token",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };

  beforeEach(() => {
    jest.spyOn(global, "fetch").mockImplementation(mockFetch);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("retrieveFileMetadata", () => {
    it("should retrieve file metadata successfully", async () => {
      const mockResponse = {
        items: [
          {
            id: 123,
            externalId: "test-file",
            name: "test.py",
            mimeType: "text/plain",
            lastUpdatedTime: "2023-01-01T00:00:00Z",
            createdTime: "2023-01-01T00:00:00Z",
          },
        ],
      };

      jest.mocked(mockFetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as unknown as Response);

      const result = await retrieveFileMetadata("test-file", mockCredentials);

      expect(result).toEqual({
        id: 123,
        externalId: "test-file",
        name: "test.py",
        mimeType: "text/plain",
        lastUpdatedTime: new Date("2023-01-01T00:00:00Z"),
        createdTime: new Date("2023-01-01T00:00:00Z"),
      });
    });

    it("should throw error when file not found", async () => {
      jest.mocked(mockFetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as unknown as Response);

      await expect(
        retrieveFileMetadata("does-not-exist", mockCredentials),
      ).rejects.toThrow("API request failed: 400 Bad Request");
    });
  });

  describe("getFileDownloadUrl", () => {
    it("should get download URL successfully", async () => {
      const mockResponse = {
        items: [{ downloadUrl: "https://download.example.test/file" }],
      };

      jest.mocked(mockFetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as unknown as Response);

      const result = await getFileDownloadUrl("test-file", mockCredentials);

      expect(result).toEqual({
        downloadUrl: "https://download.example.test/file",
      });
    });

    it("should throw error when file not found", async () => {
      jest.mocked(mockFetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as unknown as Response);

      await expect(
        getFileDownloadUrl("does-not-exist", mockCredentials),
      ).rejects.toThrow("API request failed: 400 Bad Request");
    });
  });

  describe("isZipFile", () => {
    it("should return true for .zip file extension", () => {
      expect(isZipFile("test.zip")).toBe(true);
      expect(isZipFile("TEST.ZIP")).toBe(true);
      expect(isZipFile("path/to/file.zip")).toBe(true);
    });

    it("should return true for application/zip MIME type", () => {
      expect(isZipFile("test", "application/zip")).toBe(true);
      expect(isZipFile("test.txt", "application/zip")).toBe(true);
    });

    it("should return true for application/x-zip-compressed MIME type", () => {
      expect(isZipFile("test", "application/x-zip-compressed")).toBe(true);
      expect(isZipFile("test.txt", "application/x-zip-compressed")).toBe(true);
    });

    it("should return false for non-zip files", () => {
      expect(isZipFile("test.txt")).toBe(false);
      expect(isZipFile("test.py")).toBe(false);
      expect(isZipFile("test", "text/plain")).toBe(false);
      expect(isZipFile("test", "application/json")).toBe(false);
    });

    it("should return false when no MIME type provided and no .zip extension", () => {
      expect(isZipFile("test")).toBe(false);
      expect(isZipFile("test.tar.gz")).toBe(false);
    });
  });

  describe("processZipFile", () => {
    const mockBinaryData = new ArrayBuffer(1024);
    const mockFileName = "test.zip";

    // Mock Entry type for testing
    const createMockFileEntry = (filename: string) => {
      const entry: Partial<FileEntry> = {
        filename,
        directory: false,
        getData: jest.fn(),
      };

      return entry as FileEntry;
    };

    const createMockDirectoryEntry = (foldername: string) => {
      const entry: Partial<DirectoryEntry> = {
        filename: foldername,
        directory: true,
      };

      return entry as DirectoryEntry;
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should process zip file with multiple text files successfully", async () => {
      const mockFile1 = createMockFileEntry("file1.txt");
      const mockFile2 = createMockFileEntry("file2.py");
      const mockDirectory = createMockDirectoryEntry("subdir/");
      const mockFile3 = createMockFileEntry("subdir/file3.js");

      const mockEntries = [mockFile1, mockFile2, mockDirectory, mockFile3];

      // Mock getData to return Uint8Array for each file
      const mockFile1Content = new TextEncoder().encode("Hello from file1");
      const mockFile2Content = new TextEncoder().encode(
        "print('Hello from file2')",
      );
      const mockFile3Content = new TextEncoder().encode(
        "console.log('Hello from file3')",
      );

      jest.mocked(mockFile1.getData).mockResolvedValue(mockFile1Content);
      jest.mocked(mockFile2.getData).mockResolvedValue(mockFile2Content);
      jest.mocked(mockFile3.getData).mockResolvedValue(mockFile3Content);

      const mockGetZipEntries: typeof defaultGetZipEntries = jest
        .fn()
        .mockResolvedValue(mockEntries);
      const result = await processZipFile(
        mockBinaryData,
        mockFileName,
        mockGetZipEntries,
      );

      expect(mockGetZipEntries).toHaveBeenCalledWith(mockBinaryData);
      expect(result).toEqual({
        "file1.txt": "Hello from file1",
        "file2.py": "print('Hello from file2')",
        "subdir/file3.js": "console.log('Hello from file3')",
      });

      // Verify that getData was called for files but not directories
      expect(mockFile1.getData).toHaveBeenCalled();
      expect(mockFile2.getData).toHaveBeenCalled();
      expect(mockFile3.getData).toHaveBeenCalled();
    });

    it("should throw error when file extraction fails", async () => {
      const mockEntries = [
        createMockFileEntry("file1.txt"),
        createMockFileEntry("file2.txt"),
        createMockFileEntry("file3.txt"),
      ];

      // Mock getData to succeed for first file, fail for second, succeed for third
      const mockFile1Content = new TextEncoder().encode("Success content");
      const mockFile3Content = new TextEncoder().encode("Another success");

      jest.mocked(mockEntries[0].getData).mockResolvedValue(mockFile1Content);
      jest
        .mocked(mockEntries[1].getData)
        .mockRejectedValue(new Error("Extraction failed"));
      jest.mocked(mockEntries[2].getData).mockResolvedValue(mockFile3Content);

      const mockGetZipEntries: typeof defaultGetZipEntries = jest
        .fn()
        .mockResolvedValue(mockEntries);

      await expect(
        processZipFile(mockBinaryData, mockFileName, mockGetZipEntries),
      ).rejects.toThrow("Failed to extract 1 file(s) from ZIP: file2.txt");
    });
  });
});
