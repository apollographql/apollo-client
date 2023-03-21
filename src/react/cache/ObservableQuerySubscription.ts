import equal from '@wry/equality';
import { canonicalStringify } from '../../cache';
import {
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { Concast, hasDirectives } from '../../utilities';

type Listener<TData> = (result: ApolloQueryResult<TData>) => void;

interface Subscription {
  unsubscribe: () => void;
}

function maybeWrapConcastWithCustomPromise<TData>(
  concast: Concast<ApolloQueryResult<TData>>,
  { deferred }: { deferred: boolean }
) {
  if (deferred) {
    return new Promise<ApolloQueryResult<TData>>((resolve, reject) => {
      // Unlike `concast.promise`, we want to resolve the promise on the initial
      // chunk of the deferred query. This allows the component to unsuspend
      // when we get the initial set of data, rather than waiting until all
      // chunks have been loaded.
      const subscription = concast.subscribe({
        next: (value) => {
          resolve(value);
          subscription.unsubscribe();
        },
        error: reject,
      });
    });
  }

  return concast.promise;
}

class VariablesSubscription<
  TData,
  TVariables extends OperationVariables = OperationVariables
> {
  private readonly observable: ObservableQuery<TData, OperationVariables>;
  private readonly listeners = new Set<Listener<TData>>();
  private subscription: Subscription;
  private _result: ApolloQueryResult<TData>;

  public readonly promise: Promise<ApolloQueryResult<TData>>;
  public readonly variables: TVariables | undefined;

  constructor(
    observable: ObservableQuery<TData, TVariables>,
    variables: TVariables | undefined
  ) {
    const concast = observable.reobserveAsConcast({ variables });

    this.observable = observable;
    this.variables = variables;
    this.promise = maybeWrapConcastWithCustomPromise(concast, {
      deferred: hasDirectives(['defer'], observable.query),
    });

    this.subscribeToConcast(concast);
  }

  get result() {
    return this._result;
  }

  dispose() {
    this.listeners.clear();
    this.subscription?.unsubscribe();
  }

  subscribe(listener: Listener<TData>) {
    if (!this.listeners.has(listener)) {
      this.listeners.add(listener);
    }

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private setResult(result: ApolloQueryResult<TData>) {
    if (!equal(this.result, result)) {
      this._result = result;
      this.deliver(result);
    }
  }

  private deliver(result: ApolloQueryResult<TData>) {
    this.listeners.forEach((listener) => listener(result));
  }

  private subscribeToConcast(concast: Concast<ApolloQueryResult<TData>>) {
    const subscription = concast.subscribe({
      next: (result) => this.setResult(result),
      complete: () => {
        subscription.unsubscribe();
        this.subscribeToObservable();
      },
    });
  }

  private subscribeToObservable() {
    this.subscription = this.observable.subscribe({
      next: () => this.setResult(this.observable.getCurrentResult()),
    });
  }
}

export class ObservableQuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  public promise: Promise<ApolloQueryResult<TData>>;
  public readonly observable: ObservableQuery<TData>;

  private subscriptions = new Map<string, VariablesSubscription<TData>>();
  private listeners = new Set<Listener<TData>>();
  private currentSubscription: Subscription;

  constructor(observable: ObservableQuery<TData>) {
    this.observable = observable;
    this.result = observable.getCurrentResult();
    this.fetch(observable.options.variables);
  }

  fetch<TVariables extends OperationVariables = OperationVariables>(
    variables: TVariables | undefined
  ) {
    const key = canonicalStringify(variables);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(
        key,
        new VariablesSubscription(this.observable, variables)
      );
    }

    const subscription = this.subscriptions.get(key)!;

    this.streamResultsFrom(subscription);
    this.promise = subscription.promise;

    return subscription.promise;
  }

  subscribe(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  streamResultsFrom(subscription: VariablesSubscription<TData>) {
    this.currentSubscription?.unsubscribe();

    this.setResult(subscription.result);

    this.currentSubscription = subscription.subscribe((result) => {
      this.setResult(result);
    });
  }

  dispose() {
    this.listeners.clear();
    this.subscriptions.forEach((source) => source.dispose());
  }

  setResult(result: ApolloQueryResult<TData>) {
    if (!equal(this.result, result)) {
      this.result = result;
      this.deliver(result);
    }
  }

  private deliver(result: ApolloQueryResult<TData>) {
    this.listeners.forEach((listener) => listener(result));
  }
}
