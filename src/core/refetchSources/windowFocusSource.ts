import type { RefetchEventManager } from "../RefetchEventManager.js";

export const windowFocusSource: RefetchEventManager.EventSource =
  function windowFocusSource(emit) {
    if (typeof window !== "undefined" && window.addEventListener) {
      function handleChange() {
        if (document.visibilityState === "visible") {
          emit();
        }
      }

      window.addEventListener("visibilitychange", handleChange, false);
      return () => {
        window.removeEventListener("visibilitychange", handleChange);
      };
    }
  };
