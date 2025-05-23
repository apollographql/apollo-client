import type { Tester } from "@jest/expect-utils";
import { equals, iterableEquality } from "@jest/expect-utils";
import * as matcherUtils from "jest-matcher-utils";
import type { Observer } from "rxjs";

type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

export interface TakeOptions {
  timeout?: number;
}

export class ObservableSubscriber<T> implements Observer<T> {
  private reader: ReadableStreamDefaultReader<ObservableEvent<T>>;
  private readerQueue: Array<Promise<ObservableEvent<T>>> = [];
  private controller!: ReadableStreamDefaultController<ObservableEvent<T>>;

  constructor() {
    this.reader = new ReadableStream<ObservableEvent<T>>({
      start: (controller) => {
        this.controller = controller;
      },
    }).getReader();
  }

  next(value: T) {
    this.controller.enqueue({ type: "next", value });
  }

  error(error: unknown) {
    this.controller.enqueue({ type: "error", error });
  }

  complete() {
    this.controller.enqueue({ type: "complete" });
  }

  take({ timeout = 100 }: TakeOptions = {}) {
    return Promise.race([
      this.readerQueue.shift() || this.readNextValue(),
      new Promise<ObservableEvent<T>>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]).then((value) => {
      if (value.type === "next") {
        this.current = value.value;
      }
      return value;
    });
  }

  async takeNext(options?: TakeOptions): Promise<T> {
    const event = await this.take(options);
    validateEquals(event, { type: "next", value: expect.anything() });
    return (event as ObservableEvent<T> & { type: "next" }).value;
  }

  async takeError(options?: TakeOptions): Promise<any> {
    const event = await this.take(options);
    validateEquals(event, { type: "error", error: expect.anything() });
    return (event as ObservableEvent<T> & { type: "error" }).error;
  }

  async takeComplete(options?: TakeOptions): Promise<void> {
    const event = await this.take(options);
    validateEquals(event, { type: "complete" });
  }

  private async readNextValue() {
    return this.reader.read().then((result) => result.value!);
  }

  private current?: T;
  getCurrent() {
    return this.current;
  }
}

// Lightweight expect(...).toEqual(...) check that avoids using `expect` so that
// `expect.assertions(num)` does not double count assertions when using the take*
// functions inside of expect(stream).toEmit* matchers.
function validateEquals(
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
