import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
} from 'apollo-link-core';

export default class RetryLink extends ApolloLink {
  private count: number = 0;
  private delay: number;
  private max: number;
  private interval: (delay: number, count: number) => number;
  private subscription: ZenObservable.Subscription;
  private timer;

  constructor(params?: {
    max?: number;
    delay?: number;
    interval?: (delay: number, count: number) => number;
  }) {
    super();
    this.max = (params && params.max) || 10;
    this.delay = (params && params.delay) || 300;
    this.interval = (params && params.interval) || this.defaultInterval;
  }

  public request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> {
    return new Observable(observer => {
      const subscriber = {
        next: data => {
          this.count = 0;
          observer.next(data);
        },
        error: error => {
          this.count++;
          if (this.count < this.max) {
            this.timer = setTimeout(() => {
              const observable = forward(operation);
              this.subscription = observable.subscribe(subscriber);
            }, this.interval(this.delay, this.count));
          } else {
            observer.error(error);
          }
        },
        complete: observer.complete.bind(observer),
      };

      this.subscription = forward(operation).subscribe(subscriber);

      return () => {
        this.subscription.unsubscribe();
        if (this.timer) {
          clearTimeout(this.timer);
        }
      };
    });
  }

  private defaultInterval = delay => delay;
}
