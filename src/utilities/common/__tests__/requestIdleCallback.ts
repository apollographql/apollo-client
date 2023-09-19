import { requestIdleCallback } from "../requestIdleCallback";

describe("requestIdleCallback", () => {
  const originalRequestIdleCallback = window.requestIdleCallback;

  afterAll(() => {
    Object.defineProperty(window, "requestIdleCallback", {
      value: originalRequestIdleCallback,
    });
  });

  it("should use the window method when possible", () => {
    Object.defineProperty(window, "requestIdleCallback", {
      value: jest.fn((callback) => callback()),
      configurable: true,
    });

    const task = jest.fn();
    requestIdleCallback(task);
    expect(task).toHaveBeenCalled();
  });

  it("should fall back to setTimeout when the window method is not available", () => {
    // @ts-expect-error
    delete window.requestIdleCallback;

    jest.useFakeTimers();

    const task = jest.fn();
    requestIdleCallback(task);

    expect(task).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(task).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
