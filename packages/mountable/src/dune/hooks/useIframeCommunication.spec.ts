import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useIframeCredentials } from "./useIframeCommunication";
import { Credentials } from "../types";
import { MESSAGE_TYPES } from "../types/messages";

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
  let mockPostMessage: jest.Mock;

  const credentials: Credentials = {
    token: "test-bearer-token-123",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };
  const targetOrigin = "https://app.example.test";

  beforeEach(() => {
    mockAddEventListener = jest.spyOn(window, "addEventListener");
    mockRemoveEventListener = jest.spyOn(window, "removeEventListener");

    // Create mock iframe with postMessage mock
    mockPostMessage = jest.fn();
    mockIframe = document.createElement("iframe");
    Object.defineProperty(mockIframe, "contentWindow", {
      value: { postMessage: mockPostMessage },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an iframe ref initialized as null", () => {
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    expect(result.current.iframeRef).toBeDefined();
    expect(result.current.iframeRef.current).toBeNull();
  });

  it("should set up message event listener when credentials and iframe are provided", () => {
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    // Set iframe ref to trigger effect
    act(() => {
      Object.defineProperty(result.current.iframeRef, "current", {
        value: mockIframe,
        writable: true,
      });
    });

    expect(mockAddEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should send credentials when receiving APP_READY message", () => {
    // Arrange
    mockAddEventListener.mockImplementation((type, listener) => {
      if (type === "message" && typeof listener === "function") {
        // Trigger APP_READY message immediately
        listener(
          new MessageEvent("message", {
            origin: targetOrigin,
            data: { type: MESSAGE_TYPES.APP_READY },
          }),
        );
      }
    });

    // Act
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    act(() => {
      Object.defineProperty(result.current.iframeRef, "current", {
        value: mockIframe,
        writable: true,
      });
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

  it("should ignore messages from untrusted origin", () => {
    // Arrange
    const untrustedOrigin = "https://evil.example.test";

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
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    act(() => {
      Object.defineProperty(result.current.iframeRef, "current", {
        value: mockIframe,
        writable: true,
      });
    });

    // Assert
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(untrustedOrigin),
    );
  });

  it("should send credentials on iframe load event", () => {
    // Arrange
    mockIframe.addEventListener = jest.fn();

    // Act
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    act(() => {
      Object.defineProperty(result.current.iframeRef, "current", {
        value: mockIframe,
        writable: true,
      });
    });

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
    mockIframe.addEventListener = jest.fn();
    mockIframe.removeEventListener = jest.fn();

    const { result, unmount } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    act(() => {
      Object.defineProperty(result.current.iframeRef, "current", {
        value: mockIframe,
        writable: true,
      });
    });

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
    renderHook(() => useIframeCredentials(null, targetOrigin));

    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it("should not send credentials when iframe ref is null", () => {
    // Arrange
    let messageHandler: ((event: MessageEvent) => void) | undefined;

    mockAddEventListener.mockImplementation((type, listener) => {
      if (type === "message" && typeof listener === "function") {
        messageHandler = listener as (event: MessageEvent) => void;
      }
    });

    // Act - render without setting iframe ref
    renderHook(() => useIframeCredentials(credentials, targetOrigin));

    // Trigger message event after hook is mounted
    act(() => {
      messageHandler?.(
        new MessageEvent("message", {
          origin: targetOrigin,
          data: { type: MESSAGE_TYPES.APP_READY },
        }),
      );
    });

    // Assert - no errors should be thrown (accessing null ref would throw)
    // Test passes if we get here without error
    expect(mockAddEventListener).toHaveBeenCalled();
  });
});
