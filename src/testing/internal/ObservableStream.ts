import { ReadableStream } from "node:stream/web";

import type { Tester } from "@jest/expect-utils";
import { equals, iterableEquality } from "@jest/expect-utils";
import { expect } from "@jest/globals";
import * as matcherUtils from "jest-matcher-utils";
import type { Subscribable, Unsubscribable } from "rxjs";

export interface TakeOptions {
  timeout?: number;
}
type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

export class ObservableStream<T> {
  private reader: ReadableStreamDefaultReader<ObservableEvent<T>>;
  private subscription!: Unsubscribable;
  private readerQueue: Array<Promise<ObservableEvent<T>>> = [];

  constructor(observable: Subscribable<T>) {
    this.unsubscribe = this.unsubscribe.bind(this);
    this.reader = new ReadableStream<ObservableEvent<T>>({
      start: (controller) => {
        this.subscription = observable.subscribe({
          next: (value) => controller.enqueue({ type: "next", value }),
          error: (error) => controller.enqueue({ type: "error", error }),
          complete: () => controller.enqueue({ type: "complete" }),
        });
      },
    }).getReader();
  }

  peek({ timeout = 100 }: TakeOptions = {}) {
    // Calling `peek` multiple times in a row should not advance the reader
    // multiple times until this value has been consumed.
    let readerPromise = this.readerQueue[0];

    if (!readerPromise) {
      // Since this.reader.read() advances the reader in the stream, we don't
      // want to consume this promise entirely, otherwise we will miss it when
      // calling `take`. Instead, we push it into a queue that can be consumed
      // by `take` the next time its called so that we avoid advancing the
      // reader until we are finished processing all peeked values.
      readerPromise = this.readNextValue();
      this.readerQueue.push(readerPromise);
    }

    return Promise.race([
      readerPromise,
      new Promise<ObservableEvent<T>>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]);
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
    ]);
  }

  unsubscribe() {
    this.subscription.unsubscribe();
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
