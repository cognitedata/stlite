import {
  retrieveFileMetadata,
  getFileDownloadUrl,
  type Credentials,
  type CogniteFile,
  type CogniteDownloadUrl,
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
      const mockResponse: { items: CogniteFile[] } = {
        items: [
          {
            id: 123,
            externalId: "test-file",
            name: "test.py",
            mimeType: "text/plain",
            lastUpdatedTime: 1672531200000,
            createdTime: 1672531200000,
          },
        ],
      };

      const mockJson = jest.fn(() => Promise.resolve(mockResponse));
      const mockedResponse: Partial<Response> = {
        ok: true,
        json: mockJson,
      };
      jest.mocked(mockFetch).mockResolvedValueOnce(mockedResponse as Response);

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
      const mockedResponse: Partial<Response> = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
      };
      jest.mocked(mockFetch).mockResolvedValueOnce(mockedResponse as Response);

      await expect(
        retrieveFileMetadata("does-not-exist", mockCredentials),
      ).rejects.toThrow("API request failed: 400 Bad Request");
    });
  });

  describe("getFileDownloadUrl", () => {
    it("should get download URL successfully", async () => {
      const mockResponse: { items: CogniteDownloadUrl[] } = {
        items: [{ downloadUrl: "https://download.example.test/file" }],
      };

      const mockJson = jest.fn(() => Promise.resolve(mockResponse));
      const mockedResponse: Partial<Response> = {
        ok: true,
        json: mockJson,
      };
      jest.mocked(mockFetch).mockResolvedValueOnce(mockedResponse as Response);

      const result = await getFileDownloadUrl("test-file", mockCredentials);

      expect(result).toEqual({
        downloadUrl: "https://download.example.test/file",
      });
    });

    it("should throw error when file not found", async () => {
      const mockedResponse: Partial<Response> = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
      };
      jest.mocked(mockFetch).mockResolvedValueOnce(mockedResponse as Response);

      await expect(
        getFileDownloadUrl("does-not-exist", mockCredentials),
      ).rejects.toThrow("API request failed: 400 Bad Request");
    });
  });
});
