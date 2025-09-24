import { renderHook, waitFor } from "@testing-library/react";
import { useFetchFileContent } from "./useFetchFileContent";
import { type Credentials } from "../utils/fileUtils";

const mockRetrieveFileMetadata = jest.fn() as jest.MockedFunction<
  (externalId: string, credentials: Credentials) => Promise<any>
>;
const mockGetFileDownloadUrl = jest.fn() as jest.MockedFunction<
  (
    externalId: string,
    credentials: Credentials,
  ) => Promise<{ downloadUrl: string }>
>;

describe("useFetchFileContent", () => {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  const mockCredentials: Credentials = {
    token: "test-token",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };

  beforeEach(() => {
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  it("should fetch file content successfully", async () => {
    const mockFile = {
      id: 123,
      externalId: "test-file",
      name: "test.py",
      mimeType: "text/plain",
      lastUpdatedTime: new Date("2023-01-01T00:00:00Z"),
    };

    const mockDownloadUrl = "https://download.example.test/file";
    const mockFileContent = new ArrayBuffer(8);

    // Mock the utility functions
    mockRetrieveFileMetadata.mockResolvedValueOnce(mockFile);
    mockGetFileDownloadUrl.mockResolvedValueOnce({
      downloadUrl: mockDownloadUrl,
    });

    // Mock the fetch call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValueOnce(mockFileContent),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useFetchFileContent(
        "test-file",
        mockCredentials,
        mockRetrieveFileMetadata,
        mockGetFileDownloadUrl,
      ),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.fileContent).toBeUndefined();
    expect(result.current.error).toBeNull();

    // Wait for the hook to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check the result
    expect(result.current.fileContent).toEqual({
      binaryData: mockFileContent,
      fileName: "test.py",
      mimeType: "text/plain",
      lastUpdated: new Date("2023-01-01T00:00:00Z"),
    });
    expect(result.current.error).toBeNull();

    // Verify the utility functions were called
    expect(mockRetrieveFileMetadata).toHaveBeenCalledWith(
      "test-file",
      mockCredentials,
    );
    expect(mockGetFileDownloadUrl).toHaveBeenCalledWith(
      "test-file",
      mockCredentials,
    );
    expect(mockFetch).toHaveBeenCalledWith(mockDownloadUrl);
  });

  it("should handle errors", async () => {
    const error = new Error("API request failed: 400 Bad Request");

    // Mock the utility function to throw an error
    mockRetrieveFileMetadata.mockRejectedValueOnce(error);

    const { result } = renderHook(() =>
      useFetchFileContent(
        "test-file",
        mockCredentials,
        mockRetrieveFileMetadata,
        mockGetFileDownloadUrl,
      ),
    );

    // Wait for the hook to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check the error state
    expect(result.current.fileContent).toBeUndefined();
    expect(result.current.error).toEqual(error);
  });

  it("should not fetch when appId or credentials are missing", () => {
    const { result: result1 } = renderHook(() =>
      useFetchFileContent(
        undefined,
        mockCredentials,
        mockRetrieveFileMetadata,
        mockGetFileDownloadUrl,
      ),
    );

    const { result: result2 } = renderHook(() =>
      useFetchFileContent(
        "test-file",
        null,
        mockRetrieveFileMetadata,
        mockGetFileDownloadUrl,
      ),
    );

    expect(result1.current.fileContent).toBeUndefined();
    expect(result1.current.isLoading).toBe(false);
    expect(result1.current.error).toBeNull();

    expect(result2.current.fileContent).toBeUndefined();
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.error).toBeNull();

    // Verify no API calls were made
    expect(mockRetrieveFileMetadata).not.toHaveBeenCalled();
    expect(mockGetFileDownloadUrl).not.toHaveBeenCalled();
  });
});
