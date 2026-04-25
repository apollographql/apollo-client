import type { RefetchEventManager } from "../RefetchEventManager.js";

export const onlineSource: RefetchEventManager.EventSource =
  function onlineSource(emit) {
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", emit, false);

      return () => {
        window.removeEventListener("online", emit);
      };
    }
  };
