import {
  retrieveFileMetadata,
  getFileDownloadUrl,
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
});
