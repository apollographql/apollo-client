import equal from '@wry/equality';
import { Observer } from 'zen-observable-ts';
import { canonicalStringify } from '../../cache';
import {
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import {
  Concast,
  hasDirectives,
  iterateObserversSafely,
} from '../../utilities';

type Listener<TData> = (result: ApolloQueryResult<TData>) => void;

interface Subscription {
  unsubscribe: () => void;
}

interface DataSource<TData> {
  result: ApolloQueryResult<TData>;
  subscribe(observer: Observer<ApolloQueryResult<TData>>): Subscription;
}

interface ConcastDataSourceOptions {
  deferred: boolean;
}

class ObservableQueryDataSource<TData> implements DataSource<TData> {
  private observableQuery: ObservableQuery<TData>;
  private _result: ApolloQueryResult<TData>;

  constructor(observableQuery: ObservableQuery<TData>) {
    this.observableQuery = observableQuery;
    this._result = observableQuery.getCurrentResult();
  }

  get result() {
    return this._result;
  }

  subscribe(observer: Observer<ApolloQueryResult<TData>>) {
    return this.observableQuery.subscribe({
      next: () => {
        const result = this.observableQuery.getCurrentResult();

        if (!equal(this.result, result)) {
          this._result = result;
          observer.next?.(result);
        }
      },
    });
  }
}

class ConcastDataSource<TData> implements DataSource<TData> {
  private readonly concast: Concast<ApolloQueryResult<TData>>;
  private observers = new Set<Observer<ApolloQueryResult<TData>>>();
  private _result: ApolloQueryResult<TData>;
  private _completed = false;

  public readonly promise: Promise<ApolloQueryResult<TData>>;

  constructor(
    concast: Concast<ApolloQueryResult<TData>>,
    { deferred }: ConcastDataSourceOptions
  ) {
    this.concast = concast;
    this.promise = this.maybeWrapConcastWithCustomPromise(concast, {
      deferred,
    });

    this.subscribeToConcast();
  }

  get result() {
    return this._result;
  }

  get completed() {
    return this._completed;
  }

  subscribe(observer: Observer<ApolloQueryResult<TData>>) {
    if (!this.observers.has(observer)) {
      this.observers.add(observer);
    }

    if (this.completed) {
      observer.next?.(this.result);
      observer.complete?.();
    }

    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      },
    };
  }

  private subscribeToConcast() {
    const subscription = this.concast.subscribe({
      next: (result) => {
        if (!equal(this.result, result)) {
          this._result = result;
          iterateObserversSafely(this.observers, 'next', result);
        }
      },
      complete: () => {
        this._completed = true;
        subscription.unsubscribe();
        iterateObserversSafely(this.observers, 'complete');
      },
    });
  }

  private maybeWrapConcastWithCustomPromise(
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
}

export class ObservableQuerySubscription<TData = any> {
  public result: ApolloQueryResult<TData>;
  public promise: Promise<ApolloQueryResult<TData>>;
  public readonly observable: ObservableQuery<TData>;

  private dataSources = new Map<string, ConcastDataSource<TData>>();
  private observableQueryDataSource: ObservableQueryDataSource<TData>;
  private listeners = new Set<Listener<TData>>();
  private subscriptions = new Set<Subscription>();
  private deferred: boolean;
  private subscription: Subscription;

  constructor(observable: ObservableQuery<TData>) {
    this.observable = observable;
    this.observableQueryDataSource = new ObservableQueryDataSource(observable);
    this.deferred = hasDirectives(['defer'], observable.query);
    this.result = observable.getCurrentResult();
    this.fetch(observable.options.variables);
  }

  fetch<TVariables extends OperationVariables = OperationVariables>(
    variables: TVariables | undefined
  ) {
    const key = canonicalStringify(variables);

    if (!this.dataSources.has(key)) {
      const concast = this.observable.reobserveAsConcast({ variables });
      this.dataSources.set(
        key,
        new ConcastDataSource(concast, { deferred: this.deferred })
      );
    }
    const dataSource = this.dataSources.get(key)!;

    this.streamResultsFrom(dataSource);
    this.promise = dataSource.promise;

    return dataSource.promise;
  }

  subscribe(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  streamResultsFrom(dataSource: DataSource<TData>) {
    this.subscription?.unsubscribe();

    this.setResult(dataSource.result);

    this.subscription = dataSource.subscribe({
      next: (result) => this.setResult(result),
      complete: () => {
        this.streamResultsFrom(this.observableQueryDataSource);
      },
    });
  }

  dispose() {
    this.listeners.clear();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
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
