import { tap } from "rxjs";

type ObservableEvent<T> =
  | { type: "complete" }
  | { type: "error"; error: unknown }
  | { type: "next"; value: T };

/** @internal */
export function onAnyEvent<T>(
  handleEvent: (event: ObservableEvent<T>) => void
) {
  return tap<T>({
    next: (value) => handleEvent({ type: "next", value }),
    error: (error) => handleEvent({ type: "error", error }),
    complete: () => handleEvent({ type: "complete" }),
  });
}
