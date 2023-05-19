import { invariant as i, InvariantError } from "ts-invariant";
import { version } from "../../version";
import global from "./global";

function wrap(fn: (msg: string, ...args: any[]) => void) {
  return function (message?: string | number, ...args: any[]) {
    fn(getErrorMsg(message, () => []), ...args);
  }
}

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
  {
    debug: wrap(i.debug),
    log: wrap(i.log),
    warn: wrap(i.warn),
    error: wrap(i.error)
  }
);

function newInvariantError(message?: string | number, getArgsLazy?: () => unknown[]) {
  return new InvariantError(getErrorMsg(message, getArgsLazy));
}

const ApolloErrorMessageHandler = Symbol.for('ApolloErrorMessageHandler')
declare global {
	interface Window {
		[ApolloErrorMessageHandler]?(message?: string | number, getArgsLazy?: () => unknown[]): string
	}
}

function getErrorMsg(message?: string | number, getArgsLazy?: () => unknown[]) {
  return global[ApolloErrorMessageHandler] ? global[ApolloErrorMessageHandler](message, getArgsLazy) :
  `An error occured! For more details, see the full error text at https://phryneas.github.io/apollo-error-message-viewer/#${encodeURIComponent(JSON.stringify({
    version,
    message,
    args: getArgsLazy ? getArgsLazy() : []
  }))}`
}

export { invariant, InvariantError, newInvariantError, ApolloErrorMessageHandler }
