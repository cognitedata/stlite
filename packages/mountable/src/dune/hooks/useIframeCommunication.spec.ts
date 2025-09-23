import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useIframeCredentials } from "./useIframeCommunication";
import { Credentials } from "../types";
import { MESSAGE_TYPES } from "../types/messages";

// Mock React.useRef before the hook module is imported
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useRef: jest.fn(),
}));

const React = require("react");

describe("useIframeCredentials", () => {
  let mockAddEventListener: jest.SpyInstance<
    void,
    Parameters<typeof window.addEventListener>
  >;
  let mockRemoveEventListener: jest.SpyInstance<
    void,
    Parameters<typeof window.removeEventListener>
  >;
  let mockIframe: HTMLIFrameElement;
  let mockPostMessage: jest.MockedFunction<Window["postMessage"]>;
  let mockRef: { current: HTMLIFrameElement | null };

  const credentials: Credentials = {
    token: "test-bearer-token-123",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };
  const targetOrigin = "https://app.example.test";

  beforeEach(() => {
    mockAddEventListener = jest.spyOn(window, "addEventListener");
    mockRemoveEventListener = jest.spyOn(window, "removeEventListener");

    // Create fresh mock for each test
    mockPostMessage = jest.mocked(jest.fn()) as jest.MockedFunction<
      Window["postMessage"]
    >;
    mockIframe = document.createElement("iframe");
    Object.defineProperty(mockIframe, "contentWindow", {
      value: { postMessage: mockPostMessage },
      configurable: true,
    });

    // Setup controlled ref
    mockRef = { current: null };
    React.useRef.mockReturnValue(mockRef);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an iframe ref initialized as null", () => {
    // Arrange
    const testRef = { current: null };
    React.useRef.mockReturnValue(testRef);

    // Act
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    // Assert
    expect(result.current.iframeRef).toBeDefined();
    expect(result.current.iframeRef.current).toBeNull();
  });

  it("should set up message event listener when credentials and iframe are provided", () => {
    // Arrange
    mockRef.current = mockIframe;

    // Act
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Assert
    expect(mockAddEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should send credentials when receiving APP_READY message", () => {
    // Arrange
    mockRef.current = mockIframe;

    mockAddEventListener.mockImplementation((type, listener) => {
      if (type === "message" && typeof listener === "function") {
        listener(
          new MessageEvent("message", {
            origin: targetOrigin,
            data: { type: MESSAGE_TYPES.APP_READY },
          }),
        );
      }
    });

    // Act
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Assert
    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
        credentials,
      },
      targetOrigin,
    );
  });

  it("should ignore messages from untrusted origin", () => {
    // Arrange
    const untrustedOrigin = "https://evil.example.test";
    mockRef.current = mockIframe;

    jest.spyOn(console, "warn").mockImplementation();

    mockAddEventListener.mockImplementation((type, listener) => {
      if (type === "message" && typeof listener === "function") {
        listener(
          new MessageEvent("message", {
            origin: untrustedOrigin,
            data: { type: MESSAGE_TYPES.APP_READY },
          }),
        );
      }
    });

    // Act
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Assert
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(untrustedOrigin),
    );
  });

  it("should send credentials on iframe load event", () => {
    // Arrange
    mockRef.current = mockIframe;
    mockIframe.addEventListener = jest.fn();

    // Act
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Simulate iframe load event
    const loadHandler = (
      mockIframe.addEventListener as jest.Mock
    ).mock.calls.find(([type]) => type === "load")?.[1];

    act(() => {
      loadHandler?.();
    });

    // Assert
    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
        credentials,
      },
      targetOrigin,
    );
  });

  it("should remove event listeners on unmount", () => {
    // Arrange
    mockRef.current = mockIframe;
    mockIframe.addEventListener = jest.fn();
    mockIframe.removeEventListener = jest.fn();

    const { unmount } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    // Act
    unmount();

    // Assert
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    expect(mockIframe.removeEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
    );
  });

  it("should not set up listeners when credentials are null", () => {
    // Arrange
    const testRef = { current: null };
    React.useRef.mockReturnValue(testRef);

    // Act
    renderHook(() => useIframeCredentials(null, targetOrigin));

    // Assert
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it("should not send credentials when iframe ref is null", () => {
    // Arrange
    mockRef.current = null;

    // Act
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Assert
    expect(mockAddEventListener).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
