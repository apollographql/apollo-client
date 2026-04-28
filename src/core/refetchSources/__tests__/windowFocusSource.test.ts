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
  setVisibilityState("visible");
  using stream = new ObservableStream(windowFocusSource());

  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).toEmitNext();
});

test("windowFocusSource does not emit when document visibility is not visible", async () => {
  setVisibilityState("hidden");
  using stream = new ObservableStream(windowFocusSource());

  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).not.toEmitAnything();
});

test("windowFocusSource unsubscribe stops further visibilitychange events from emitting", async () => {
  setVisibilityState("visible");
  const stream = new ObservableStream(windowFocusSource());

  stream.unsubscribe();

  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).not.toEmitAnything();
});
