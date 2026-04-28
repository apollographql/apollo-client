import { EMPTY, fromEvent, map } from "rxjs";

import type { RefetchEventManager } from "../RefetchEventManager.js";

export const onlineSource: RefetchEventManager.EventSource =
  function onlineSource() {
    if (typeof window === "undefined" || !window.addEventListener) {
      return EMPTY;
    }

    return fromEvent(window, "online").pipe(map(() => {}));
  };
