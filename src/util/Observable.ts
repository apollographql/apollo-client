export type SubscriberFunction<T> = (observer: Observer<T>) => Function;

export class Observable<T> {
  constructor(private subscriberFunction: SubscriberFunction<T>) {
  }

  subscribe(observer: Observer<T>) {
    const tearDownFunction = this.subscriberFunction(observer);

    return {
      unsubscribe: tearDownFunction,
    };
  }
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface Subscription {
  unsubscribe: () => void
}
