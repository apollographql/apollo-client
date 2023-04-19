import {
  ApolloError,
  ApolloQueryResult,
  DocumentNode,
  NetworkStatus,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { isNetworkRequestSettled } from '../../core';
import {
  Concast,
  ObservableSubscription,
  hasAnyDirectives,
  createFulfilledPromise,
} from '../../utilities';
import { invariant } from '../../utilities/globals';
import { wrap } from 'optimism';

type Listener = () => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>['fetchMore']
>[0];

function wrapWithCustomPromise<TData>(
  concast: Concast<ApolloQueryResult<TData>>
) {
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

const isMultipartQuery = wrap((query: DocumentNode) => {
  return hasAnyDirectives(['defer', 'stream'], query);
});

interface QuerySubscriptionOptions {
  onDispose?: () => void;
  autoDisposeTimeoutMs?: number;
}

interface PromiseChannel<TData> {
  main: Promise<ApolloQueryResult<TData>>;
  refetch?: Promise<ApolloQueryResult<TData>>;
}

export class QuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  public readonly observable: ObservableQuery<TData>;

  private subscription: ObservableSubscription;
  private listeners = new Set<Listener>();
  private autoDisposeTimeoutId: NodeJS.Timeout;

  private channels: PromiseChannel<TData>;

  constructor(
    observable: ObservableQuery<TData>,
    options: QuerySubscriptionOptions = Object.create(null)
  ) {
    this.listen = this.listen.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);
    this.dispose = this.dispose.bind(this);
    this.observable = observable;
    this.result = observable.getCurrentResult(false);

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    if (
      isNetworkRequestSettled(this.result.networkStatus) ||
      (this.result.data &&
        (!this.result.partial || this.observable.options.returnPartialData))
    ) {
      this.channels = {
        main: createFulfilledPromise(this.result),
      };
    }

    this.subscription = observable.subscribe({
      next: this.handleNext,
      error: this.handleError,
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

    const concast = observable['concast'];

    if (!this.channels) {
      this.channels = {
        main: isMultipartQuery(observable.query)
          ? wrapWithCustomPromise(concast)
          : concast.promise,
      };
    }

    // Start a timer that will automatically dispose of the query if the
    // suspended resource does not use this subscription in the given time. This
    // helps prevent memory leaks when a component has unmounted before the
    // query has finished loading.
    this.autoDisposeTimeoutId = setTimeout(
      this.dispose,
      options.autoDisposeTimeoutMs ?? 30_000
    );
  }

  getPromise(channel: 'main' | 'refetch') {
    return this.channels[channel] || this.channels.main;
  }

  listen(listener: Listener) {
    // As soon as the component listens for updates, we know it has finished
    // suspending and is ready to receive updates, so we can remove the auto
    // dispose timer.
    clearTimeout(this.autoDisposeTimeoutId);

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  refetch(variables: OperationVariables | undefined) {
    const promise = this.observable.refetch(variables);

    this.channels.refetch = promise;

    return promise;
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    const promise = this.observable.fetchMore<TData>(options);

    this.channels.refetch = promise;

    return promise;
  }

  dispose() {
    this.subscription.unsubscribe();
    this.onDispose();
  }

  private onDispose() {
    // noop. overridable by options
  }

  private handleNext(result: ApolloQueryResult<TData>) {
    if (result.data === this.result.data) {
      return;
    }

    // If we encounter an error with the new result after we have successfully
    // fetched a previous result, set the new result data to the last successful
    // result.
    if (this.result.data && result.data === void 0) {
      result.data = this.result.data;
    }

    this.result = result;
    this.channels.main = createFulfilledPromise(result);
    this.deliver();
  }

  private handleError(error: ApolloError) {
    const result = {
      ...this.result,
      error,
      networkStatus: NetworkStatus.error,
    };

    this.result = result;
    this.deliver();
  }

  private deliver() {
    this.listeners.forEach((listener) => listener());
  }
}
