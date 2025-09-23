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
    // Type-safe event handler types
    type MessageEventHandler = (event: MessageEvent) => void;
    type AddEventListenerCall = [
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions | undefined,
    ];

    let addEventListenerSpy: jest.SpyInstance<
      void,
      Parameters<typeof window.addEventListener>
    >;
    let removeEventListenerSpy: jest.SpyInstance<
      void,
      Parameters<typeof window.removeEventListener>
    >;

    beforeEach(() => {
      addEventListenerSpy = jest.spyOn(window, "addEventListener");
      removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    // Helper to capture message event handler with proper typing
    const captureMessageHandler = (
      spy: jest.SpyInstance<void, Parameters<typeof window.addEventListener>>,
    ): MessageEventHandler | undefined => {
      const calls: readonly AddEventListenerCall[] = spy.mock.calls;
      const messageCall = calls.find(([type]) => type === "message");

      if (!messageCall || !messageCall[1]) {
        return undefined;
      }

      const listener = messageCall[1];
      if (typeof listener === "function") {
        return listener as MessageEventHandler;
      }

      return undefined;
    };

    // Helper to create a mock MessageEvent for testing
    const createMockMessageEvent = (overrides: {
      origin: string;
      data: any;
    }): MessageEvent => {
      return new MessageEvent("message", {
        origin: overrides.origin,
        data: overrides.data,
      });
    };

    const setupTest = () => {
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

      // Create a mock contentWindow - using any because we only need it for postMessage
      const mockContentWindow: any = {
        postMessage: jest.fn(),
      };

      // Create a mock iframe element
      const mockIframe = document.createElement("iframe");

      // Mock the contentWindow property
      Object.defineProperty(mockIframe, "contentWindow", {
        value: mockContentWindow,
        writable: true,
      });

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

      // Get the message handler using type-safe helper
      const messageHandler = captureMessageHandler(addEventListenerSpy);

      if (!messageHandler) {
        throw new Error(
          "Failed to capture message handler from addEventListener",
        );
      }

      return {
        mockContentWindow,
        messageHandler,
        rerender,
        unmount,
      };
    };

    it("should send credentials when receiving APP_READY message", () => {
      const { mockContentWindow, messageHandler } = setupTest();

      // Simulate iframe sending APP_READY
      act(() => {
        messageHandler(
          createMockMessageEvent({
            data: { type: MESSAGE_TYPES.APP_READY },
            origin: mockTargetOrigin,
          }),
        );
      });

      // Verify credentials were sent
      expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
        {
          type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
          credentials: mockCredentials,
        },
        mockTargetOrigin,
      );
    });

    it("should ignore messages from untrusted origin", () => {
      const { mockContentWindow, messageHandler } = setupTest();
      const untrustedOrigin = "https://evil.example.test";

      // Simulate message from untrusted origin
      act(() => {
        messageHandler(
          createMockMessageEvent({
            data: { type: MESSAGE_TYPES.APP_READY },
            origin: untrustedOrigin,
          }),
        );
      });

      // Should NOT send credentials
      expect(mockContentWindow.postMessage).not.toHaveBeenCalled();

      // Should warn about untrusted origin
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(untrustedOrigin),
      );
    });

    it("should remove event listeners on unmount", () => {
      const { unmount } = setupTest();

      unmount();

      // Should remove message listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });
  });
});
