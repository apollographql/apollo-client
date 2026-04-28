import { EMPTY, fromEvent } from "rxjs";

import type { RefetchEventManager } from "../RefetchEventManager.js";

export const onlineSource: RefetchEventManager.EventSource<Event> = () => {
  if (typeof window === "undefined" || !window.addEventListener) {
    return EMPTY;
  }

  return fromEvent(window, "online");
};
