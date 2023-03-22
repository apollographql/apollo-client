import equal from '@wry/equality';
import invariant from 'ts-invariant';
import {
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { Concast, hasDirectives } from '../../utilities';

type Listener<TData> = (result: ApolloQueryResult<TData>) => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>['fetchMore']
>[0];

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

interface Options {
  onDispose?: () => void;
}

export class ObservableQuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  public promise: Promise<ApolloQueryResult<TData>>;
  public readonly observable: ObservableQuery<TData>;

  private subscription: Subscription;
  private listeners = new Set<Listener<TData>>();

  constructor(
    observable: ObservableQuery<TData>,
    options: Options = Object.create(null)
  ) {
    this.handleNext = this.handleNext.bind(this);
    this.observable = observable;
    this.result = observable.getCurrentResult();

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    this.subscription = observable.subscribe({
      next: this.handleNext,
      error: this.handleNext,
    });

    // This error should never happen since the `.subscribe` call above
    // will ensure a concast is set on the observable via the `reobserve`
    // call. Unless something is going horribly wrong and completely messing
    // around with the internals of the observable, there should always be a
    // concast after subscribing.
    invariant(
      observable['concast'],
      'Unexpected error: A concast was not found on the observable.'
    );

    this.promise = maybeWrapConcastWithCustomPromise(observable['concast'], {
      deferred: hasDirectives(['defer'], observable.query),
    });
  }

  onDispose() {
    // noop. overridable by options
  }

  subscribe(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  refetch(variables: OperationVariables | undefined) {
    this.promise = this.observable.refetch(variables);

    return this.promise;
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    this.promise = this.observable.fetchMore<TData>(options);

    return this.promise;
  }

  dispose() {
    this.listeners.clear();
    this.subscription.unsubscribe();
    this.onDispose();
  }

  private handleNext() {
    const result = this.observable.getCurrentResult();

    if (!equal(this.result, result)) {
      this.result = result;
      this.deliver(result);
    }
  }

  private deliver(result: ApolloQueryResult<TData>) {
    this.listeners.forEach((listener) => listener(result));
  }
}
