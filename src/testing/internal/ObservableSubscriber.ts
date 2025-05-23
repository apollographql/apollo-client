import type { Observer } from "rxjs";

import type { ObservableEvent } from "./utils/observable.js";
import { validateEquals } from "./utils/observable.js";

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
