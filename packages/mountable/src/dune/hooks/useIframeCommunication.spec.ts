import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useIframeCredentials } from "./useIframeCommunication";
import { Credentials } from "../types";
import { MESSAGE_TYPES } from "../constants";

describe("useIframeCredentials", () => {
  const mockCredentials: Credentials = {
    token: "test-bearer-token-123",
    project: "test-project",
    baseUrl: "https://api.cognitedata.test",
  };

  const mockTargetOrigin = "https://app.example.test";

  // Mock iframe element
  class MockHTMLIFrameElement {
    contentWindow: { postMessage: jest.Mock } | null;
    addEventListener = jest.fn();
    removeEventListener = jest.fn();

    constructor() {
      this.contentWindow = {
        postMessage: jest.fn(),
      };
    }
  }

  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an iframe ref", () => {
    const { result } = renderHook(() =>
      useIframeCredentials(mockCredentials, mockTargetOrigin),
    );

    expect(result.current.iframeRef).toBeDefined();
    expect(result.current.iframeRef.current).toBeNull();
  });

  describe("Core message handling", () => {
    const setupTest = () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      const { result, rerender, unmount } = renderHook<
        { iframeRef: React.RefObject<HTMLIFrameElement> },
        { credentials: Credentials | null; targetOrigin: string }
      >(
        ({ credentials, targetOrigin }) =>
          useIframeCredentials(credentials, targetOrigin),
        {
          initialProps: {
            credentials: null,
            targetOrigin: mockTargetOrigin,
          },
        },
      );

      const mockIframe = new MockHTMLIFrameElement();

      // Set iframe ref
      act(() => {
        Object.defineProperty(result.current.iframeRef, "current", {
          writable: true,
          value: mockIframe,
        });
      });

      // Add credentials to trigger effect
      rerender({
        credentials: mockCredentials,
        targetOrigin: mockTargetOrigin,
      });

      // Get the message handler that was registered
      const messageHandler = addEventListenerSpy.mock.calls.find(
        ([type]) => type === "message",
      )?.[1] as (event: MessageEvent) => void;

      return {
        mockIframe,
        messageHandler,
        rerender,
        unmount,
        cleanup: () => addEventListenerSpy.mockRestore(),
      };
    };

    it("should send credentials when receiving APP_READY message", () => {
      const { mockIframe, messageHandler, cleanup } = setupTest();

      // Simulate iframe sending APP_READY
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: { type: MESSAGE_TYPES.APP_READY },
            origin: mockTargetOrigin,
          }),
        );
      });

      // Verify credentials were sent
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        {
          type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
          credentials: mockCredentials,
        },
        mockTargetOrigin,
      );

      cleanup();
    });

    it("should send credentials when receiving REQUEST_CREDENTIALS message", () => {
      const { mockIframe, messageHandler, cleanup } = setupTest();

      // Simulate iframe requesting credentials
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: { type: MESSAGE_TYPES.REQUEST_CREDENTIALS },
            origin: mockTargetOrigin,
          }),
        );
      });

      // Verify credentials were sent
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        {
          type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
          credentials: mockCredentials,
        },
        mockTargetOrigin,
      );

      cleanup();
    });

    it("should ignore messages from untrusted origin", () => {
      const { mockIframe, messageHandler, cleanup } = setupTest();

      const untrustedOrigin = "https://evil.example.test";

      // Simulate message from untrusted origin
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: { type: MESSAGE_TYPES.APP_READY },
            origin: untrustedOrigin,
          }),
        );
      });

      // Should NOT send credentials
      expect(mockIframe.contentWindow?.postMessage).not.toHaveBeenCalled();

      // Should warn about untrusted origin
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(untrustedOrigin),
      );

      cleanup();
    });

    it("should not send credentials when starting with null credentials", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      // Start with null credentials
      const { result } = renderHook(
        ({ credentials, targetOrigin }) =>
          useIframeCredentials(credentials, targetOrigin),
        {
          initialProps: {
            credentials: null,
            targetOrigin: mockTargetOrigin,
          },
        },
      );

      const mockIframe = new MockHTMLIFrameElement();

      // Set iframe ref
      act(() => {
        Object.defineProperty(result.current.iframeRef, "current", {
          writable: true,
          value: mockIframe,
        });
      });

      // Get the message handler (if any was registered)
      const messageHandler = addEventListenerSpy.mock.calls.find(
        ([type]) => type === "message",
      )?.[1] as ((event: MessageEvent) => void) | undefined;

      // Since credentials are null, no handler should be registered
      // But if there is one, it shouldn't send anything
      if (messageHandler) {
        act(() => {
          messageHandler(
            new MessageEvent("message", {
              data: { type: MESSAGE_TYPES.APP_READY },
              origin: mockTargetOrigin,
            }),
          );
        });
      }

      // Should not send anything
      expect(mockIframe.contentWindow?.postMessage).not.toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });

    it("should remove event listeners on unmount", () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
      const { unmount, cleanup } = setupTest();

      unmount();

      // Should remove message listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
      cleanup();
    });
  });
});
