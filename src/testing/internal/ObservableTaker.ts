import type { Observable } from "../../utilities/index.js";

interface PeekOptions {
  timeout?: number;
}
type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

async function* observableToAsyncEventIterator<T>(observable: Observable<T>) {
  let resolveNext: (value: ObservableEvent<T>) => void;
  const promises: Promise<ObservableEvent<T>>[] = [];
  pushPromise();

  function pushPromise() {
    promises.push(
      new Promise<ObservableEvent<T>>((resolve) => {
        resolveNext = (event: ObservableEvent<T>) => {
          resolve(event)
          pushPromise();
        };
      })
    );
  }

  observable.subscribe(
    (value) => resolveNext({ type: "next", value }),
    (error) => resolveNext({ type: "error", error }),
    () => resolveNext({ type: "complete" })
  );

  while (true) {
    yield promises.shift()!;
  }
}

class IteratorTaker<T> {
  constructor(private iterator: AsyncGenerator<T, void, unknown>) {}

  async take({ timeout = 100 }: PeekOptions = {}): Promise<T> {
    return Promise.race([
      this.iterator.next().then((result) => result.value!),
      new Promise<T>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]);
  }
}

export class ObservableTaker<T> extends IteratorTaker<ObservableEvent<T>> {
  constructor(observable: Observable<T>) {
    super(observableToAsyncEventIterator(observable));
  }

  async takeNext(options?: PeekOptions): Promise<T> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "next", value: expect.anything() });
    return (event as ObservableEvent<T> & { type: "next" }).value;
  }

  async takeError(options?: PeekOptions): Promise<any> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "error", error: expect.anything() });
    return (event as ObservableEvent<T> & { type: "error" }).error;
  }

  async takeComplete(options?: PeekOptions): Promise<void> {
    const event = await this.take(options);
    expect(event).toEqual({ type: "complete" });
  }
}
