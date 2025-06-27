import { Slot } from "optimism";
import { invariant } from "../globals/index.js";

const slot = new Slot<string[]>();

type WithValueArgs<TResult, TArgs extends any[], TThis> = [
  callback: (this: TThis, ...args: TArgs) => TResult,
  args?: TArgs | undefined,
  thisArg?: TThis | undefined,
];

type DeprecationName =
  | "addTypename"
  | "canonizeResults"
  | "connectToDevTools"
  | "parser"
  | "withQuery"
  | "withMutation"
  | "withSubscription";

function isMuted(name: string) {
  return (slot.getValue() || []).includes(name as string);
}

export function muteDeprecations<TResult, TArgs extends any[], TThis = any>(
  name: DeprecationName | DeprecationName[],
  ...args: WithValueArgs<TResult, TArgs, TThis>
) {
  return slot.withValue(Array.isArray(name) ? name : [name], ...args);
}

export function warnRemovedOption<TOptions extends Record<string, any>>(
  options: TOptions,
  name: keyof TOptions,
  callSite: string,
  recommendation: string = "Please remove this option."
) {
  warnDeprecated(name as string, () => {
    if (name in options) {
      invariant.warn(
        "[%s]: `%s` is deprecated and will be removed in Apollo Client 4.0. %s",
        callSite,
        name,
        recommendation
      );
    }
  });
}

export function warnDeprecated(name: string, cb: () => void) {
  if (!isMuted(name)) {
    cb();
  }
}
