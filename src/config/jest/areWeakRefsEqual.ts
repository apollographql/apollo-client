import type { Tester } from "@jest/expect-utils";

export const areWeakRefsEqual: Tester = function (a, b, customTesters) {
  if (a && a instanceof WeakRef && b && b instanceof WeakRef)
    return this.equals(a.deref(), b.deref(), customTesters);
};
