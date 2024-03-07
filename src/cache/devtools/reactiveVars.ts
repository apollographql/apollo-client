import { makeVar as orig_makeVar } from "../index.js";
import { sendToDevtools } from "../../devtools/index.js";

interface MakeVarOptions {
  displayName?: string;
  connectToDevTools?: boolean;
}

let idCounter = 0;

export function makeVar<T>(
  value: T,
  { displayName, connectToDevTools = __DEV__ }: MakeVarOptions = Object.create(
    null
  )
) {
  if (connectToDevTools) {
    const id = ++idCounter;

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
