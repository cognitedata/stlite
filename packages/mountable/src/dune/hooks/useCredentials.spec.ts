import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useCredentials, Credentials } from "./hooks/useCredentials";

// Type for the hook return value
type UseCredentialsReturn = {
  credentials: Credentials | null;
};

describe("useCredentials", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with null credentials", () => {
      const { result } = renderHook<UseCredentialsReturn, void>(() =>
        useCredentials(),
      );
      expect(result.current.credentials).toBeNull();
    });
  });

  describe("Message handling", () => {
    // Type-safe helper to capture message event handlers
    type MessageEventHandler = (event: MessageEvent) => void;
    type AddEventListenerCall = [
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions | undefined,
    ];

    // Helper to create a mock MessageEvent for testing
    const createMockMessageEvent = (
      data: Partial<Credentials> | null | undefined | Record<string, unknown>,
    ): MessageEvent => {
      return new MessageEvent("message", {
        data,
        origin: "https://fusion.example.test",
      });
    };

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

    const setupHookWithMessageHandler = (): {
      result: { current: UseCredentialsReturn };
      messageHandler: MessageEventHandler;
      unmount: () => void;
      cleanup: () => void;
    } => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      const { result, unmount } = renderHook<UseCredentialsReturn, void>(() =>
        useCredentials(),
      );

      const messageHandler = captureMessageHandler(addEventListenerSpy);
      if (!messageHandler) {
        throw new Error(
          "Failed to capture message handler from addEventListener",
        );
      }

      return {
        result,
        messageHandler,
        unmount,
        cleanup: () => {
          addEventListenerSpy.mockRestore();
          removeEventListenerSpy.mockRestore();
        },
      };
    };

    it("should set up message event listener on mount", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      renderHook(() => useCredentials());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
    });

    it("should handle valid credentials message", async () => {
      const { result, messageHandler, cleanup } = setupHookWithMessageHandler();

      const mockCredentials = {
        token: "test-bearer-token-123",
        project: "test-project",
        baseUrl: "https://api.cognitedata.test",
      };

      act(() => {
        messageHandler(createMockMessageEvent(mockCredentials));
      });

      await waitFor(() => {
        expect(result.current.credentials).toEqual(mockCredentials);
      });

      cleanup();
    });

    it("should ignore messages without complete credentials", () => {
      const { result, messageHandler, cleanup } = setupHookWithMessageHandler();

      // Test with missing token
      act(() => {
        messageHandler(
          createMockMessageEvent({
            project: "test-project",
            baseUrl: "https://api.cognitedata.test",
          }),
        );
      });

      expect(result.current.credentials).toBeNull();

      // Test with missing project
      act(() => {
        messageHandler(
          createMockMessageEvent({
            token: "test-token",
            baseUrl: "https://api.cognitedata.test",
          }),
        );
      });

      expect(result.current.credentials).toBeNull();

      // Test with missing baseUrl
      act(() => {
        messageHandler(
          createMockMessageEvent({
            token: "test-token",
            project: "test-project",
          }),
        );
      });

      expect(result.current.credentials).toBeNull();

      cleanup();
    });

    it("should ignore messages with null or undefined data", () => {
      const { result, messageHandler, cleanup } = setupHookWithMessageHandler();

      // Test with null data
      act(() => {
        messageHandler(createMockMessageEvent(null));
      });

      expect(result.current.credentials).toBeNull();

      // Test with undefined data
      act(() => {
        messageHandler(createMockMessageEvent(undefined));
      });

      expect(result.current.credentials).toBeNull();

      cleanup();
    });

    it("should handle multiple credential updates", async () => {
      const { result, messageHandler, cleanup } = setupHookWithMessageHandler();

      const firstCredentials = {
        token: "first-token",
        project: "first-project",
        baseUrl: "https://first.cognitedata.test",
      };

      const secondCredentials = {
        token: "second-token",
        project: "second-project",
        baseUrl: "https://second.cognitedata.test",
      };

      // Send first credentials
      act(() => {
        messageHandler(createMockMessageEvent(firstCredentials));
      });

      await waitFor(() => {
        expect(result.current.credentials).toEqual(firstCredentials);
      });

      // Send second credentials
      act(() => {
        messageHandler(createMockMessageEvent(secondCredentials));
      });

      await waitFor(() => {
        expect(result.current.credentials).toEqual(secondCredentials);
      });

      cleanup();
    });

    it("should extract only required fields from message with extra properties", async () => {
      const { result, messageHandler, cleanup } = setupHookWithMessageHandler();

      const messageWithExtras = {
        token: "test-token",
        project: "test-project",
        baseUrl: "https://api.cognitedata.test",
        extraField: "should-be-ignored",
        anotherExtra: 123,
        nested: { object: "also-ignored" },
      };

      act(() => {
        messageHandler(createMockMessageEvent(messageWithExtras));
      });

      await waitFor(() => {
        // Should only include the expected fields
        expect(result.current.credentials).toEqual({
          token: "test-token",
          project: "test-project",
          baseUrl: "https://api.cognitedata.test",
        });
      });

      cleanup();
    });
  });

  describe("Parent window communication", () => {
    it("should send app-ready signal to parent window when in iframe", () => {
      const postMessageSpy = jest.fn();
      const originalParent = window.parent;

      // Mock window.parent to be different from window (simulating iframe)
      Object.defineProperty(window, "parent", {
        writable: true,
        configurable: true,
        value: { postMessage: postMessageSpy },
      });

      renderHook(() => useCredentials());

      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: "APP_HOST_READY" },
        "*",
      );

      // Restore original parent
      Object.defineProperty(window, "parent", {
        writable: true,
        configurable: true,
        value: originalParent,
      });
    });

    it("should not send app-ready signal when not in iframe", () => {
      const postMessageSpy = jest.fn();
      const originalParent = window.parent;

      // Mock window.parent to be same as window (not in iframe)
      Object.defineProperty(window, "parent", {
        writable: true,
        configurable: true,
        value: window,
      });

      // Add postMessage to window for verification
      window.postMessage = postMessageSpy;

      renderHook(() => useCredentials());

      expect(postMessageSpy).not.toHaveBeenCalled();

      // Restore original parent
      Object.defineProperty(window, "parent", {
        writable: true,
        configurable: true,
        value: originalParent,
      });
    });
  });

  describe("Cleanup", () => {
    it("should remove event listener on unmount", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useCredentials());

      // Capture the handler that was added
      const addedHandler = addEventListenerSpy.mock.calls.find(
        ([type]) => type === "message",
      )?.[1];

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        addedHandler,
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
