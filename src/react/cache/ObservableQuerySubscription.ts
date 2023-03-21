import equal from '@wry/equality';
import { Subscription } from 'zen-observable-ts';
import { ApolloQueryResult, ObservableQuery } from '../../core';

type Listener<TData> = (result: ApolloQueryResult<TData>) => void;

export class ObservableQuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  private listeners = new Set<Listener<TData>>();
  private subscription: Subscription;
  private observable: ObservableQuery<TData>;

  constructor(observable: ObservableQuery<TData>) {
    this.handleNext = this.handleNext.bind(this);

    this.observable = observable;
    this.result = observable.getCurrentResult();
    this.subscription = observable.subscribe({
      next: this.handleNext,
      error: this.handleNext,
    });
  }

  subscribe(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.listeners.clear();
    this.subscription.unsubscribe();
  }

  private handleNext() {
    const result = this.observable.getCurrentResult();

    if (!equal(this.result, result)) {
      this.result = result;
      this.notify(result);
    }
  }

  private notify(result: ApolloQueryResult<TData>) {
    this.listeners.forEach((listener) => listener(result));
  }
}
