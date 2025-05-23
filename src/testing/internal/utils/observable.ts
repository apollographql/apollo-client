import type { Tester } from "@jest/expect-utils";
import { equals, iterableEquality } from "@jest/expect-utils";
import * as matcherUtils from "jest-matcher-utils";

export type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

// Lightweight expect(...).toEqual(...) check that avoids using `expect` so that
// `expect.assertions(num)` does not double count assertions when using the take*
// functions inside of expect(stream).toEmit* matchers.
export function validateEquals(
  actualEvent: ObservableEvent<any>,
  expectedEvent: ObservableEvent<any>
) {
  // Uses the same matchers as expect(...).toEqual(...)
  // https://github.com/jestjs/jest/blob/611d1a4ba0008d67b5dcda485177f0813b2b573e/packages/expect/src/matchers.ts#L626-L629
  const isEqual = equals(actualEvent, expectedEvent, [
    ...getCustomMatchers(),
    iterableEquality,
  ]);

  if (isEqual) {
    return;
  }

  const hint = matcherUtils.matcherHint("toEqual", "stream", "expected");

  throw new Error(
    hint +
      "\n\n" +
      matcherUtils.printDiffOrStringify(
        expectedEvent,
        actualEvent,
        "Expected",
        "Received",
        true
      )
  );
}

function getCustomMatchers(): Array<Tester> {
  // https://github.com/jestjs/jest/blob/611d1a4ba0008d67b5dcda485177f0813b2b573e/packages/expect/src/jestMatchersObject.ts#L141-L143
  const JEST_MATCHERS_OBJECT = Symbol.for("$$jest-matchers-object");
  return (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters;
}
