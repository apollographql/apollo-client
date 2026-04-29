import { EMPTY, filter, fromEvent } from "rxjs";

import { canUseDOM } from "@apollo/client/utilities/internal";

import type { RefetchEventManager } from "../RefetchEventManager.js";

export const windowFocusSource: RefetchEventManager.EventSource<Event> = () => {
  if (!canUseDOM) {
    return EMPTY;
  }

  return fromEvent(window, "visibilitychange").pipe(
    filter(() => document.visibilityState === "visible")
  );
};
