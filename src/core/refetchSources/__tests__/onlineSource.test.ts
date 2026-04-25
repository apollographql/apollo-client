import { onlineSource } from "@apollo/client";

test("onlineSource calls emit when the online event fires", () => {
  const emit = jest.fn();

  const cleanup = onlineSource(emit);

  window.dispatchEvent(new Event("online"));

  expect(emit).toHaveBeenCalledTimes(1);

  cleanup?.();
});

test("onlineSource cleanup stops further online events from triggering emit", () => {
  const emit = jest.fn();

  const cleanup = onlineSource(emit);

  cleanup?.();

  window.dispatchEvent(new Event("online"));

  expect(emit).not.toHaveBeenCalled();
});
