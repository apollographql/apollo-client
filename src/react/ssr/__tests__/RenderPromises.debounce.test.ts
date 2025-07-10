import { RenderPromises } from "../RenderPromises.js";
import type { QueryDataOptions } from "../../types/types.js";
import { Kind } from "graphql";

describe("RenderPromises with debounced batching", () => {
  let renderPromises: RenderPromises;

  beforeEach(() => {
    renderPromises = new RenderPromises();
  });

  afterEach(() => {
    renderPromises.stop();
  });

  it("should resolve on first promise in debounced mode", async () => {
    const fastPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 10);
    });

    const slowPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100);
    });

    const mockOptions1: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    const mockOptions2: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 2 },
    };

    // Add promises to the map directly for testing
    (renderPromises as any).queryPromises.set(mockOptions1, fastPromise);
    (renderPromises as any).queryPromises.set(mockOptions2, slowPromise);

    const startTime = Date.now();

    await renderPromises.consumeAndAwaitPromises({
      batchOptions: { debounce: 50 },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should resolve quickly (around 10ms) not wait for the slow promise
    expect(duration).toBeLessThan(50);
  });

  it("should handle promise rejections correctly in debounced mode", async () => {
    const fastPromise = Promise.resolve();
    const failingPromise = Promise.reject(new Error("Test error"));

    const mockOptions1: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    const mockOptions2: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 2 },
    };

    (renderPromises as any).queryPromises.set(mockOptions1, fastPromise);
    (renderPromises as any).queryPromises.set(mockOptions2, failingPromise);

    // Should resolve successfully because fastPromise resolves first
    await expect(
      renderPromises.consumeAndAwaitPromises({
        batchOptions: { debounce: 10 },
      })
    ).resolves.toBeUndefined();
  });

  it("should reject when all promises fail in debounced mode", async () => {
    const failingPromise1 = Promise.reject(new Error("Error 1"));
    const failingPromise2 = Promise.reject(new Error("Error 2"));

    const mockOptions1: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    const mockOptions2: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 2 },
    };

    (renderPromises as any).queryPromises.set(mockOptions1, failingPromise1);
    (renderPromises as any).queryPromises.set(mockOptions2, failingPromise2);

    // Should reject when all promises fail
    await expect(
      renderPromises.consumeAndAwaitPromises({
        batchOptions: { debounce: 10 },
      })
    ).rejects.toThrow("All 2 queries failed during SSR");
  });

  it("should timeout when debounce expires", async () => {
    const slowPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100);
    });

    const mockOptions: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    (renderPromises as any).queryPromises.set(mockOptions, slowPromise);

    const startTime = Date.now();

    await renderPromises.consumeAndAwaitPromises({
      batchOptions: { debounce: 20 },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should timeout around 20ms, not wait for the 100ms promise
    expect(duration).toBeGreaterThanOrEqual(15);
    expect(duration).toBeLessThan(50);
  });

  it("should track resolved promises to prevent infinite loops", async () => {
    const mockOptions: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    const promise = Promise.resolve();

    (renderPromises as any).queryPromises.set(mockOptions, promise);

    await renderPromises.consumeAndAwaitPromises({
      batchOptions: { debounce: 10 },
    });

    // The promise should be marked as resolved
    expect((renderPromises as any).resolvedPromises.has(mockOptions)).toBe(
      true
    );

    // Adding the same query again should not create a new promise
    const result = renderPromises.addQueryPromise({
      getOptions: () => mockOptions,
      fetchData: () => Promise.resolve(),
    });

    // Should return finish() instead of null (indicating no new promise was created)
    expect(result).toBe(null);
  });

  it("should clear resolved promises on stop", () => {
    const mockOptions: QueryDataOptions<any, any> = {
      query: { kind: Kind.DOCUMENT, definitions: [] },
      variables: { id: 1 },
    };

    (renderPromises as any).resolvedPromises.add(mockOptions);
    expect((renderPromises as any).resolvedPromises.has(mockOptions)).toBe(
      true
    );

    renderPromises.stop();
    expect((renderPromises as any).resolvedPromises.has(mockOptions)).toBe(
      false
    );
  });
});
