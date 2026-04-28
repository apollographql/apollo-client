import { windowFocusSource } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

afterEach(() => {
  setVisibilityState("visible");
});

test("windowFocusSource emits when document becomes visible", async () => {
  using stream = new ObservableStream(windowFocusSource());

  setVisibilityState("visible");
  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).toEmitNext();

  setVisibilityState("hidden");
  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).not.toEmitAnything();

  setVisibilityState("visible");
  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).toEmitNext();

  await expect(stream).not.toEmitAnything();
});

test("windowFocusSource unsubscribe stops further visibilitychange events from emitting", async () => {
  const stream = new ObservableStream(windowFocusSource());

  stream.unsubscribe();

  setVisibilityState("visible");
  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).not.toEmitAnything();
});
