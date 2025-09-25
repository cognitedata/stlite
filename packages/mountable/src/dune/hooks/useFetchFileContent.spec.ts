import { renderHook, waitFor } from "@testing-library/react";
import { useFetchFileContent } from "./useFetchFileContent";
import {
  type Credentials,
  retrieveFileMetadata,
  getFileDownloadUrl,
} from "../utils/fileUtils";

describe("useFetchFileContent", () => {
  const mockRetrieveFileMetadata: typeof retrieveFileMetadata = jest.fn();
  const mockGetFileDownloadUrl: typeof getFileDownloadUrl = jest.fn();
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

  it("should fetch file content successfully", async () => {
    const mockFile: CogniteFile = {
      id: 123,
      externalId: "test-file",
      name: "test.py",
      mimeType: "text/plain",
      lastUpdatedTime: new Date("2023-01-01T00:00:00Z"),
    };

    const mockDownloadUrl = "https://download.example.test/file";
    const mockFileContent = new ArrayBuffer(8);

    // Mock the utility functions
    jest.mocked(mockRetrieveFileMetadata).mockResolvedValueOnce(mockFile);
    jest.mocked(mockGetFileDownloadUrl).mockResolvedValueOnce({
      downloadUrl: mockDownloadUrl,
    });

    // Mock the fetch call
    const mockedResponse: Partial<Response> = {
      ok: true,
      arrayBuffer: jest.fn(() => Promise.resolve(mockFileContent)),
    };
    jest.mocked(mockFetch).mockResolvedValueOnce(mockedResponse as Response);

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
    expect(jest.mocked(mockRetrieveFileMetadata)).toHaveBeenCalledWith(
      "test-file",
      mockCredentials,
    );
    expect(jest.mocked(mockGetFileDownloadUrl)).toHaveBeenCalledWith(
      "test-file",
      mockCredentials,
    );
    expect(mockFetch).toHaveBeenCalledWith(mockDownloadUrl);
  });

  it("should handle errors", async () => {
    const error = new Error("API request failed: 400 Bad Request");

    // Mock the utility function to throw an error
    jest.mocked(mockRetrieveFileMetadata).mockRejectedValueOnce(error);

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
    expect(jest.mocked(mockRetrieveFileMetadata)).not.toHaveBeenCalled();
    expect(jest.mocked(mockGetFileDownloadUrl)).not.toHaveBeenCalled();

  it('should ignore in-flight request if hook is rerendered', async () => {
    // Arrange
    const mockFile: CogniteFile = {
      id: 123,
      externalId: "test-file",
      name: "test.py",
      mimeType: "text/plain",
      lastUpdatedTime: new Date("2023-01-01T00:00:00Z"),
    };
    jest.mocked(mockRetrieveFileMetadata).mockResolvedValue(mockFile);
    jest.mocked(mockGetFileDownloadUrl).mockResolvedValue({
      downloadUrl: "https://download.example.test/file",
    });
    const stubResponse1: Partial<Response> = {
      ok: true,
      arrayBuffer: () => Promise.resolve(Uint8Array.from('file1').buffer),
    };
    const stubResponse2: Partial<Response> = {
      ok: true,
      arrayBuffer: () => Promise.resolve(Uint8Array.from('file2').buffer),
    };
    const { promise: fetchPromise1, resolve: fetchResolve1 } = createResolvablePromise<Response>();
    const { promise: fetchPromise2, resolve: fetchResolve2 } = createResolvablePromise<Response>();
    jest.mocked(mockFetch)
      .mockImplementationOnce(() => fetchPromise1)
      .mockImplementationOnce(() => fetchPromise2);

    // Act
    // First trigger the first fetch operation
    const { result, rerender } = renderHook((props: { appId: string }) =>
      useFetchFileContent(
        props.appId,
        mockCredentials,
        mockRetrieveFileMetadata,
        mockGetFileDownloadUrl,
      ),
      { initialProps: { appId: "file1" } },
    );
    expect(result.current.isLoading).toBe(true);
    // Trigger the second fetch operation
    rerender({ appId: "file2" });
    expect(result.current.isLoading).toBe(true);
    
    // Complete the requests, but in the wrong order (i.e. the first request is completed last)
    fetchResolve2(stubResponse2 as Response);
    fetchResolve1(stubResponse1 as Response);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current).toEqual({
      isLoading: false,
      error: null,
      fileContent: {
        binaryData: Uint8Array.from('file2').buffer,
        fileName: "test.py",
        mimeType: "text/plain",
        lastUpdated: new Date("2023-01-01T00:00:00Z"),
      },
    });
  });
});

/**
 * Creates a promise that can be resolved or rejected "manually". Useful for testing
 * where you want to control when primises are resolved/reject.
 * @returns An object with a promise, a resolve function, and a reject function.
 */
function createResolvablePromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  if (!resolve || !reject) {
    // This can never happen - callback will be evaluated immediately
    // by Promise constructor. Having this check makes Typescript happy
    throw new Error('resolve or reject has not been assigned');
  }
  return { promise, resolve, reject };
}
