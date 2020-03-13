import { ExecutionResult, DocumentNode, GraphQLError } from 'graphql';
import { equal } from "@wry/equality";

import { Cache } from '../cache/core/types/Cache';
import { ApolloCache } from '../cache/core/cache';
import { WatchQueryOptions } from './watchQueryOptions';
import { ObservableQuery } from './ObservableQuery';
import { QueryListener } from './types';
import { ObservableSubscription } from '../utilities/observables/Observable';
import { isNonEmptyArray } from '../utilities/common/arrays';
import { graphQLResultHasError } from '../utilities/common/errorHandling';
import {
  NetworkStatus,
  isNetworkRequestInFlight,
} from './networkStatus';

export type QueryStoreValue = Pick<QueryInfo,
  | "variables"
  | "networkStatus"
  | "networkError"
  | "graphQLErrors"
  >;

// A QueryInfo object represents a single query managed by the
// QueryManager, which tracks all QueryInfo objects by queryId in its
// this.queries Map. QueryInfo objects store the latest results and errors
// for the given query, and are responsible for reporting those results to
// the corresponding ObservableQuery, via the QueryInfo.notify method.
// Results are reported asynchronously whenever setDirty marks the
// QueryInfo object as dirty, though a call to the QueryManager's
// broadcastQueries method may trigger the notification before it happens
// automatically. This class used to be a simple interface type without
// any field privacy or meaningful methods, which is why it still has so
// many public fields. The effort to lock down and simplify the QueryInfo
// interface is ongoing, and further improvements are welcome.
export class QueryInfo {
  listeners = new Set<QueryListener>();
  document: DocumentNode | null = null;
  lastRequestId = 1;
  observableQuery: ObservableQuery<any> | null = null;
  subscriptions = new Set<ObservableSubscription>();
  variables?: Record<string, any>;
  networkStatus?: NetworkStatus;
  networkError?: Error;
  graphQLErrors?: ReadonlyArray<GraphQLError>;

  constructor(private cache: ApolloCache<any>) {}

  public init(query: {
    document: DocumentNode;
    variables: Record<string, any>;
    isPoll: boolean;
    isRefetch: boolean;
    observableQuery?: ObservableQuery<any>;
    lastRequestId?: number;
  }): this {
    // TODO break this out into a separate function
    let networkStatus: NetworkStatus;
    if (this.variables &&
        this.networkStatus !== NetworkStatus.loading &&
        !equal(this.variables, query.variables)) {
      networkStatus = NetworkStatus.setVariables;
    } else if (query.isPoll) {
      networkStatus = NetworkStatus.poll;
    } else if (query.isRefetch) {
      networkStatus = NetworkStatus.refetch;
      // TODO: can we determine setVariables here if it's a refetch and the variables have changed?
    } else {
      networkStatus = NetworkStatus.loading;
    }

    Object.assign(this, {
      document: query.document,
      variables: query.variables,
      networkError: null,
      graphQLErrors: this && this.graphQLErrors || [],
      networkStatus,
    });

    if (query.observableQuery) {
      this.observableQuery = query.observableQuery;
    }

    if (query.lastRequestId) {
      this.lastRequestId = query.lastRequestId;
    }

    return this;
  }

  private dirty: boolean = false;

  public isDirty() {
    return this.dirty;
  }

  public setDirty(): this {
    if (!this.dirty) {
      this.dirty = true;
      if (!this.notifyTimeout) {
        this.notifyTimeout = setTimeout(() => this.notify(), 0);
      }
    }
    return this;
  }

  private notifyTimeout?: ReturnType<typeof setTimeout>;

  private diff: Cache.DiffResult<any> | null = null;

  setDiff(diff: Cache.DiffResult<any> | null) {
    const oldDiff = this.diff;
    this.diff = diff;
    if (!this.dirty && diff?.result !== oldDiff?.result) {
      this.setDirty();
    }
  }

  getDiff() {
    if (!this.diff) {
      const oq = this.observableQuery;
      const lastResult = oq && oq.getLastResult();
      const lastError = oq && oq.getLastError();
      const fetchPolicy = oq && oq.options.fetchPolicy || "cache-first";
      const errorPolicy = this.getErrorPolicy();
      const errorStatusChanged =
        errorPolicy !== 'none' &&
        (lastError && lastError.graphQLErrors) !== this.graphQLErrors;

      if (lastResult && lastResult.data && !errorStatusChanged) {
        this.diff = {
          result: lastResult.data,
          complete: true,
        };
      } else if (fetchPolicy !== "no-cache" &&
                 fetchPolicy !== "network-only") {
        this.diff = this.cache.diff({
          query: this.document as DocumentNode,
          variables: this.variables,
          returnPartialData: true,
          optimistic: true,
        });
      }
    }

    return this.diff;
  }

  private getErrorPolicy() {
    const oq = this.observableQuery;
    return oq && oq.options.errorPolicy || "none";
  }

  notify() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = void 0;
    }

    if (this.shouldNotify() && this.getDiff()) {
      this.listeners.forEach(listener => listener(this));
      this.dirty = false;
    }
  }

  private shouldNotify() {
    if (!this.dirty || !this.listeners.size) {
      return false;
    }

    if (!this.observableQuery) {
      return true;
    }

    const {
      fetchPolicy,
      returnPartialData,
      notifyOnNetworkStatusChange,
    } = this.observableQuery.options;

    if (fetchPolicy === "standby") {
      return false;
    }

    if (isNetworkRequestInFlight(this.networkStatus)) {
      const lastResult = this.observableQuery.getLastResult();

      const networkStatusChanged = !!(
        lastResult &&
        lastResult.networkStatus !== this.networkStatus
      );

      const shouldNotifyIfLoading =
        returnPartialData ||
        this.networkStatus === NetworkStatus.setVariables ||
        (networkStatusChanged && notifyOnNetworkStatusChange) ||
        fetchPolicy === 'cache-only' ||
        fetchPolicy === 'cache-and-network';

      if (!shouldNotifyIfLoading) {
        return false;
      }
    }

    return true;
  }

  public stop() {
    this.cancel();
    // Revert back to the no-op version of cancel inherited from
    // QueryInfo.prototype.
    delete this.cancel;

    this.variables =
    this.networkStatus =
    this.networkError =
    this.graphQLErrors = void 0;
  }

  // This method can be overridden for a given instance.
  public cancel() {}

  public updateWatch(options: WatchQueryOptions): this {
    this.cancel();

    const previousResult = () => {
      let previousResult = null;
      const { observableQuery } = this;
      if (observableQuery) {
        const lastResult = observableQuery.getLastResult();
        if (lastResult) {
          previousResult = lastResult.data;
        }
      }
      return previousResult;
    };

    this.cancel = this.cache.watch({
      query: this.document,
      variables: options.variables,
      optimistic: true,
      previousResult,
      callback: diff => {
        this.setDiff(diff);
      },
    });

    return this;
  }

  public markResult(
    result: ExecutionResult,
    { fetchPolicy,
      variables,
      errorPolicy,
    }: WatchQueryOptions,
    allowCacheWrite: boolean,
    makeReady: boolean,
  ) {
    if (fetchPolicy === 'no-cache') {
      this.setDiff({ result: result.data, complete: true });
    } else if (allowCacheWrite) {
      const ignoreErrors = errorPolicy === 'ignore' || errorPolicy === 'all';
      let writeWithErrors = !graphQLResultHasError(result);
      if (!writeWithErrors && ignoreErrors && result.data) {
        writeWithErrors = true;
      }
      if (writeWithErrors) {
        this.cache.write({
          result: result.data,
          dataId: 'ROOT_QUERY',
          query: this.document,
          variables,
        });
      }
    }
    if (makeReady) {
      this.networkError = null;
      this.graphQLErrors = isNonEmptyArray(result.errors) ? result.errors : [];
      this.networkStatus = NetworkStatus.ready;
    }
  }

  public markError(error: Error) {
    this.networkError = error;
    this.networkStatus = NetworkStatus.error;
  }
}
