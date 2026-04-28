import { EMPTY, filter, fromEvent, map } from "rxjs";

import type { RefetchEventManager } from "../RefetchEventManager.js";

export const windowFocusSource: RefetchEventManager.EventSource =
  function windowFocusSource() {
    if (typeof window === "undefined" || !window.addEventListener) {
      return EMPTY;
    }

    return fromEvent(window, "visibilitychange").pipe(
      filter(() => document.visibilityState === "visible"),
      map(() => {})
    );
  };
