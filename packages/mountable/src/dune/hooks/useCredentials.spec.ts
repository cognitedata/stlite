import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useCredentials } from "./useCredentials";
import { Credentials } from "../types";

// Type for the hook return value
type UseCredentialsReturn = {
  credentials: Credentials | null;
};

describe("useCredentials", () => {
  let mockAddEventListener: jest.SpyInstance<
    void,
    Parameters<typeof window.addEventListener>
  >;
  let mockRemoveEventListener: jest.SpyInstance<
    void,
    Parameters<typeof window.removeEventListener>
  >;
  const credentials: Credentials = {
    token: "test-bearer-token-123",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };

  beforeEach(() => {
    mockAddEventListener = jest.spyOn(window, "addEventListener");
    mockRemoveEventListener = jest.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize with null credentials", () => {
    const { result } = renderHook(() => useCredentials());
    expect(result.current.credentials).toBeNull();
  });

  it("should set up message event listener on mount and remove it on unmount", () => {
    const { unmount } = renderHook(() => useCredentials());
    expect(mockAddEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should send app-ready signal to parent window", () => {
    // Arrange
    const mockParent: Partial<Window> = { postMessage: jest.fn() };
    jest.spyOn(window, "parent", "get").mockReturnValue(mockParent as Window);

    // Act
    renderHook(() => useCredentials());

    // Assert
    expect(mockParent.postMessage).toHaveBeenCalledWith(
      { type: "APP_HOST_READY" },
      "*",
    );
  });

  it("should handle credentials sent from parent window", async () => {
    // Arrange
    const mockMessageData = {
      data: credentials,
      origin: "https://fusion.example.test",
    };
    mockAddEventListener.mockImplementation((type, listener) => {
      // Trigger listener for initializing credentials immediatly on mount
      if (type === "message" && typeof listener === "function") {
        listener(new MessageEvent("message", mockMessageData));
      }
    });

    // Act
    const { result } = renderHook(() => useCredentials());

    // Assert
    expect(result.current.credentials).toEqual(credentials);
  });
});
