import { invariant as i, InvariantError as IE } from "ts-invariant";
import { version } from "../../version";

type WrappedInvariant = {
  (condition: any, message?: string | number, args?: () => unknown[]): asserts condition
  debug: typeof i["debug"];
  log: typeof i["log"];
  warn: typeof i["warn"];
  error: typeof i["error"];
}

const invariant: WrappedInvariant = Object.assign(
  function invariant(condition: any, message?: string | number, getArgsLazy?: () => unknown[]): asserts condition {
    if (!condition) {
      i(
        condition,
        getErrorMsg(message, getArgsLazy))
    }
  },
  i
);

class InvariantError extends IE {
  constructor(message?: string | number, getArgsLazy?: () => unknown[]) {
    super(getErrorMsg(message, getArgsLazy));
    (this as any).__proto__ = InvariantError.prototype;
  }
}

function getErrorMsg(message?: string | number, getArgsLazy?: () => unknown) {
  return `An error occured! For more details, see the full error text at http://someLink#${encodeURIComponent(JSON.stringify({
    version,
    message,
    args: getArgsLazy ? getArgsLazy() : []
  }))}`
}

export { invariant, InvariantError }
