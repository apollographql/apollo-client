import { Slot } from "optimism";
import { invariant } from "../globals/index.js";

const slot = new Slot<string[]>();

type WithValueArgs<TResult, TArgs extends any[], TThis> = [
  callback: (this: TThis, ...args: TArgs) => TResult,
  args?: TArgs | undefined,
  thisArg?: TThis | undefined,
];

export function silenceDeprecations<TResult, TArgs extends any[], TThis = any>(
  name: string | string[],
  ...args: WithValueArgs<TResult, TArgs, TThis>
) {
  const keys = Array.isArray(name) ? name : [name];

  return slot.withValue(keys, ...args);
}

export function warnRemovedOption<TOptions extends Record<string, any>>(
  options: TOptions,
  name: keyof TOptions,
  callSite: string,
  recommendation: string = "Please remove this option."
) {
  const silenced = (slot.getValue() || []).includes(name as string);

  if (name in options && !silenced) {
    invariant.warn(
      "[%s]: `%s` is deprecated and will be removed in Apollo Client 4.0. %s",
      callSite,
      name,
      recommendation
    );
  }
}
