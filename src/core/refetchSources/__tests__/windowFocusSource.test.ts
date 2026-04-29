import { windowFocusSource } from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

function withVisibilityState() {
  const original = Object.getOwnPropertyDescriptor(document, "visibilityState");

  return Object.assign(
    (state: DocumentVisibilityState) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });
    },
    {
      [Symbol.dispose]() {
        if (original) {
          Object.defineProperty(document, "visibilityState", original);
        } else {
          delete (document as any).visibilityState;
        }
      },
    }
  );
}

test("windowFocusSource emits when document becomes visible", async () => {
  using setVisibilityState = withVisibilityState();
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
  using setVisibilityState = withVisibilityState();
  const stream = new ObservableStream(windowFocusSource());

  stream.unsubscribe();

  setVisibilityState("visible");
  window.dispatchEvent(new Event("visibilitychange"));

  await expect(stream).not.toEmitAnything();
});
