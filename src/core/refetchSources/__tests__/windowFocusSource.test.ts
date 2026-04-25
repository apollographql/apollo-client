import { windowFocusSource } from "@apollo/client";

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

afterEach(() => {
  setVisibilityState("visible");
});

test("windowFocusSource calls emit when document becomes visible", () => {
  const emit = jest.fn();

  setVisibilityState("visible");
  const cleanup = windowFocusSource(emit);

  window.dispatchEvent(new Event("visibilitychange"));

  expect(emit).toHaveBeenCalledTimes(1);

  cleanup?.();
});

test("windowFocusSource does not call emit when document visibility is not visible", () => {
  const emit = jest.fn();

  setVisibilityState("hidden");
  const cleanup = windowFocusSource(emit);

  window.dispatchEvent(new Event("visibilitychange"));

  expect(emit).not.toHaveBeenCalled();

  cleanup?.();
});

test("windowFocusSource cleanup stops further visibilitychange events from triggering emit", () => {
  const emit = jest.fn();

  setVisibilityState("visible");
  const cleanup = windowFocusSource(emit);

  cleanup?.();

  window.dispatchEvent(new Event("visibilitychange"));

  expect(emit).not.toHaveBeenCalled();
});
