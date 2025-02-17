import { Observable } from "rxjs";

type ObservableEvent<T> =
  | { type: "complete" }
  | { type: "error"; error: unknown }
  | { type: "next"; value: T };

export function onAnyEvent<T>(
  handleEvent: (event: ObservableEvent<T>) => void
) {
  return (observable: Observable<T>) => {
    return new Observable<T>((observer) => {
      const subscription = observable.subscribe({
        next: (value) => {
          handleEvent({ type: "next", value });
          observer.next(value);
        },
        error: (error) => {
          handleEvent({ type: "error", error });
          observer.error(error);
        },
        complete: () => {
          handleEvent({ type: "complete" });
          observer.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  };
}
