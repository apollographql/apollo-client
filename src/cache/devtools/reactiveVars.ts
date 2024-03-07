import { makeVar as orig_makeVar } from "../index.js";
import { sendToDevtools } from "../../devtools/index.js";

interface MakeVarOptions {
  displayName?: string;
}

let idCounter = 0;

export function makeVar<T>(
  value: T,
  options: MakeVarOptions = Object.create(null)
) {
  if (__DEV__) {
    const id = ++idCounter;
    const { displayName } = options;

    sendToDevtools({
      type: "reactiveVar.register",
      payload: { id, displayName, initialValue: value },
    });

    const rv = orig_makeVar(value);

    rv.onNextChange(function onNextChange(newValue) {
      sendToDevtools({
        type: "reactiveVar.updateValue",
        payload: { id, value: newValue },
      });

      rv.onNextChange(onNextChange);
    });

    return rv;
  }

  return orig_makeVar(value);
}
