import {
  retrieveFileMetadata,
  getFileDownloadUrl,
  isZipFile,
  type Credentials,
} from "./fileUtils";

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
});
