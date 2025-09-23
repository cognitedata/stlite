import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useIframeCredentials } from "./useIframeCommunication";
import { Credentials } from "../types";
import { MESSAGE_TYPES } from "../types/messages";
import { MutableRefObject } from "react";

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
    const contentWindow: Partial<Window> = { postMessage: mockPostMessage };
    jest
      .spyOn(mockIframe, "contentWindow", "get")
      .mockReturnValue(contentWindow as Window);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an iframe ref initialized as null", () => {
    // Act
    const { result } = renderHook(() =>
      useIframeCredentials(credentials, targetOrigin),
    );

    // Assert
    expect(result.current.iframeRef).toBeDefined();
    expect(result.current.iframeRef.current).toBeNull();
  });

  it("should set up message event listener when credentials and iframe are provided", () => {
    // Act
    const { result, rerender } = renderHook(
      ({ creds, origin }) => useIframeCredentials(creds, origin),
      { initialProps: { creds: credentials, origin: targetOrigin } },
    );
    act(() => {
      (
        result.current.iframeRef as MutableRefObject<HTMLIFrameElement>
      ).current = mockIframe;
    });
    // Force effect to see the ref by changing props identity
    rerender({ creds: { ...credentials }, origin: targetOrigin });

    // Assert
    expect(mockAddEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should send credentials when receiving APP_READY message", () => {
    // Act
    const { result, rerender } = renderHook(
      ({ creds, origin }) => useIframeCredentials(creds, origin),
      { initialProps: { creds: credentials, origin: targetOrigin } },
    );
    act(() => {
      (
        result.current.iframeRef as MutableRefObject<HTMLIFrameElement>
      ).current = mockIframe;
    });
    // Force effect to see the ref by changing props identity
    rerender({ creds: { ...credentials }, origin: targetOrigin });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: targetOrigin,
          data: { type: MESSAGE_TYPES.APP_READY },
        }),
      );
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

    // Act
    const { result, rerender } = renderHook(
      ({ creds, origin }) => useIframeCredentials(creds, origin),
      { initialProps: { creds: credentials, origin: targetOrigin } },
    );
    act(() => {
      (
        result.current.iframeRef as MutableRefObject<HTMLIFrameElement>
      ).current = mockIframe;
    });
    // Force effect to see the ref by changing props identity
    rerender({ creds: { ...credentials }, origin: targetOrigin });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: untrustedOrigin,
          data: { type: MESSAGE_TYPES.APP_READY },
        }),
      );
    });

    // Assert
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("should remove event listeners on unmount", () => {
    // Act
    const { result, rerender, unmount } = renderHook(
      ({ creds, origin }) => useIframeCredentials(creds, origin),
      { initialProps: { creds: credentials, origin: targetOrigin } },
    );
    act(() => {
      (
        result.current.iframeRef as MutableRefObject<HTMLIFrameElement>
      ).current = mockIframe;
    });
    // Force effect to see the ref by changing props identity
    rerender({ creds: { ...credentials }, origin: targetOrigin });

    // Act
    unmount();

    // Assert
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });
});
