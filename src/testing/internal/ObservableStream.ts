import type { Observable } from "../../utilities/index.js";
import { ReadableStream } from "node:stream/web";

interface TakeOptions {
  timeout?: number;
}
type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

export class ObservableStream<T> {
  private reader: ReadableStreamDefaultReader<ObservableEvent<T>>;
  constructor(observable: Observable<T>) {
    this.reader = new ReadableStream<ObservableEvent<T>>({
      start(controller) {
        observable.subscribe(
          (value) => controller.enqueue({ type: "next", value }),
          (error) => controller.enqueue({ type: "error", error }),
          () => controller.enqueue({ type: "complete" })
        );
      },
    }).getReader();
  }

  take({ timeout = 100 }: TakeOptions = {}) {
    return Promise.race([
      this.reader.read().then((result) => result.value!),
      new Promise<T>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]);
  }

  async takeNext(options?: TakeOptions): Promise<T> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "next", value: expect.anything() });
    return (event as ObservableEvent<T> & { type: "next" }).value;
  }

  async takeError(options?: TakeOptions): Promise<any> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "error", error: expect.anything() });
    return (event as ObservableEvent<T> & { type: "error" }).error;
  }

  async takeComplete(options?: TakeOptions): Promise<void> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "complete" });
  }
}
