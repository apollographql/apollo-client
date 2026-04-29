import { EMPTY, fromEvent } from "rxjs";

import { canUseDOM } from "@apollo/client/utilities/internal";

import type { RefetchEventManager } from "../RefetchEventManager.js";

export const onlineSource: RefetchEventManager.EventSource<Event> = () => {
  return canUseDOM ? fromEvent(window, "online") : EMPTY;
};
