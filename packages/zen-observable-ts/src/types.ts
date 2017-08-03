export namespace ZenObservable {
  export interface SubscriptionObserver<T> {
    closed: boolean;
    next(value: T): void;
    error(errorValue: any): void;
    complete(): void;
  }

  export interface Subscription {
    closed: boolean;
    unsubscribe(): void;
  }

  export interface Observer<T> {
    start?(subscription: Subscription): any;
    next?(value: T): void;
    error?(errorValue: any): void;
    complete?(): void;
  }

  export type Subscriber<T> = (
    observer: SubscriptionObserver<T>,
  ) => void | (() => void) | Subscription;

  export interface ObservableLike<T> {
    subscribe?: Subscriber<T>;
  }
}
