import {
  ApolloLink,
  Operation,
  NextLink,
  FetchResult,
  Observable,
} from 'apollo-link-core';

export default class PollingLink extends ApolloLink {
  private pollInterval: (operation: Operation) => number | null;
  private timer;
  private subscription: ZenObservable.Subscription;

  constructor(pollInterval: (operation: Operation) => number | null) {
    super();
    this.pollInterval = pollInterval;
  }

  public request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> {
    return new Observable(observer => {
      const subscriber = {
        next: data => {
          observer.next(data);
        },
        error: error => observer.error(error),
      };

      const poll = () => {
        this.subscription.unsubscribe();
        this.subscription = forward(operation).subscribe(subscriber);
      };

      const interval = this.pollInterval(operation);
      if (interval !== null) {
        this.timer = setInterval(poll, interval);
      }

      this.subscription = forward(operation).subscribe(subscriber);

      return () => {
        if (this.timer) {
          clearInterval(this.timer);
        }
        this.subscription.unsubscribe();
      };
    });
  }
}
