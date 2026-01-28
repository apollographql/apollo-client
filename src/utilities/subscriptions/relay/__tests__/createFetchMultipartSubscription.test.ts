import type { RequestParameters } from "relay-runtime";

import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/relay";

const mockRequestParameters: RequestParameters = {
  cacheID: "test-cache-id",
  id: null,
  text: "subscription { test }",
  name: "TestSubscription",
  operationKind: "subscription",
  metadata: {},
} as const;

describe("createFetchMultipartSubscription", () => {
  describe("abort controller support", () => {
    it("should pass an abort signal to fetch", () => {
      let receivedSignal: AbortSignal | undefined;

      const mockFetch = jest.fn(
        (_url: string, options: RequestInit) =>
          new Promise<Response>(() => {
            // Capture the signal for verification
            receivedSignal = options.signal as AbortSignal;
          })
      );

      const subscribe = createFetchMultipartSubscription("/graphql", {
        fetch: mockFetch as typeof fetch,
      });

      const observable = subscribe(mockRequestParameters, {});

      observable.subscribe({
        next: () => {},
        error: () => {},
        complete: () => {},
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(receivedSignal).toBeDefined();
      expect(receivedSignal?.aborted).toBe(false);
    });

    it("should abort the fetch when unsubscribe is called", () => {
      let receivedSignal: AbortSignal | undefined;

      const mockFetch = jest.fn(
        (_url: string, options: RequestInit) =>
          new Promise<Response>(() => {
            receivedSignal = options.signal as AbortSignal;
          })
      );

      const subscribe = createFetchMultipartSubscription("/graphql", {
        fetch: mockFetch as typeof fetch,
      });

      const observable = subscribe(mockRequestParameters, {});

      const subscription = observable.subscribe({
        next: () => {},
        error: () => {},
        complete: () => {},
      });

      expect(receivedSignal?.aborted).toBe(false);

      subscription.unsubscribe();

      expect(receivedSignal?.aborted).toBe(true);
    });

    it("should not call sink.error when fetch is aborted", async () => {
      const errorSpy = jest.fn();

      const mockFetch = jest.fn((_url: string, options: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted.");
            abortError.name = "AbortError";
            reject(abortError);
          });
        });
      });

      const subscribe = createFetchMultipartSubscription("/graphql", {
        fetch: mockFetch as typeof fetch,
      });

      const observable = subscribe(mockRequestParameters, {});

      const subscription = observable.subscribe({
        next: () => {},
        error: errorSpy,
        complete: () => {},
      });

      subscription.unsubscribe();

      // Allow any pending promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should still call sink.error for non-abort errors", async () => {
      const errorSpy = jest.fn();
      const networkError = new Error("Network failure");

      const mockFetch = jest.fn(() => Promise.reject(networkError));

      const subscribe = createFetchMultipartSubscription("/graphql", {
        fetch: mockFetch as typeof fetch,
      });

      const observable = subscribe(mockRequestParameters, {});

      observable.subscribe({
        next: () => {},
        error: errorSpy,
        complete: () => {},
      });

      // Allow any pending promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errorSpy).toHaveBeenCalledWith(networkError);
    });
  });
});
