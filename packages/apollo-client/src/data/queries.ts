import { DocumentNode, GraphQLError, ExecutionResult } from 'graphql';
import { isEqual } from 'apollo-utilities';
import { invariant } from 'ts-invariant';
import { NetworkStatus } from '../core/networkStatus';
import { isNonEmptyArray } from '../util/arrays';

export type QueryStoreValue = {
  document: DocumentNode;
  variables: Object;
  previousVariables?: Object | null;
  networkStatus: NetworkStatus;
  networkError?: Error | null;
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  metadata: any;
};

export class QueryStore {
  private store: { [queryId: string]: QueryStoreValue } = {};

  public getStore(): { [queryId: string]: QueryStoreValue } {
    return this.store;
  }

  public get(queryId: string): QueryStoreValue {
    return this.store[queryId];
  }

  public initQuery(query: {
    queryId: string;
    document: DocumentNode;
    storePreviousVariables: boolean;
    variables: Object;
    isPoll: boolean;
    isRefetch: boolean;
    metadata: any;
    fetchMoreForQueryId: string | undefined;
  }) {
    const previousQuery = this.store[query.queryId];

    // XXX we're throwing an error here to catch bugs where a query gets overwritten by a new one.
    // we should implement a separate action for refetching so that QUERY_INIT may never overwrite
    // an existing query (see also: https://github.com/apollostack/apollo-client/issues/732)
    invariant(
      !previousQuery ||
      previousQuery.document === query.document ||
      isEqual(previousQuery.document, query.document),
      'Internal Error: may not update existing query string in store',
    );

    let isSetVariables = false;

    let previousVariables: Object | null = null;
    if (
      query.storePreviousVariables &&
      previousQuery &&
      previousQuery.networkStatus !== NetworkStatus.loading
      // if the previous query was still loading, we don't want to remember it at all.
    ) {
      if (!isEqual(previousQuery.variables, query.variables)) {
        isSetVariables = true;
        previousVariables = previousQuery.variables;
      }
    }

    // TODO break this out into a separate function
    let networkStatus;
    if (isSetVariables) {
      networkStatus = NetworkStatus.setVariables;
    } else if (query.isPoll) {
      networkStatus = NetworkStatus.poll;
    } else if (query.isRefetch) {
      networkStatus = NetworkStatus.refetch;
      // TODO: can we determine setVariables here if it's a refetch and the variables have changed?
    } else {
      networkStatus = NetworkStatus.loading;
    }

    let graphQLErrors: ReadonlyArray<GraphQLError> = [];
    if (previousQuery && previousQuery.graphQLErrors) {
      graphQLErrors = previousQuery.graphQLErrors;
    }

    // XXX right now if QUERY_INIT is fired twice, like in a refetch situation, we just overwrite
    // the store. We probably want a refetch action instead, because I suspect that if you refetch
    // before the initial fetch is done, you'll get an error.
    this.store[query.queryId] = {
      document: query.document,
      variables: query.variables,
      previousVariables,
      networkError: null,
      graphQLErrors: graphQLErrors,
      networkStatus,
      metadata: query.metadata,
    };

    // If the action had a `moreForQueryId` property then we need to set the
    // network status on that query as well to `fetchMore`.
    //
    // We have a complement to this if statement in the query result and query
    // error action branch, but importantly *not* in the client result branch.
    // This is because the implementation of `fetchMore` *always* sets
    // `fetchPolicy` to `network-only` so we would never have a client result.
    if (
      typeof query.fetchMoreForQueryId === 'string' &&
      this.store[query.fetchMoreForQueryId]
    ) {
      this.store[query.fetchMoreForQueryId].networkStatus =
        NetworkStatus.fetchMore;
    }
  }

  public markQueryResult(
    queryId: string,
    result: ExecutionResult,
    fetchMoreForQueryId: string | undefined,
  ) {
    if (!this.store || !this.store[queryId]) return;

    this.store[queryId].networkError = null;
    this.store[queryId].graphQLErrors = isNonEmptyArray(result.errors) ? result.errors : [];
    this.store[queryId].previousVariables = null;
    this.store[queryId].networkStatus = NetworkStatus.ready;

    // If we have a `fetchMoreForQueryId` then we need to update the network
    // status for that query. See the branch for query initialization for more
    // explanation about this process.
    if (
      typeof fetchMoreForQueryId === 'string' &&
      this.store[fetchMoreForQueryId]
    ) {
      this.store[fetchMoreForQueryId].networkStatus = NetworkStatus.ready;
    }
  }

  public markQueryError(
    queryId: string,
    error: Error,
    fetchMoreForQueryId: string | undefined,
  ) {
    if (!this.store || !this.store[queryId]) return;

    this.store[queryId].networkError = error;
    this.store[queryId].networkStatus = NetworkStatus.error;

    // If we have a `fetchMoreForQueryId` then we need to update the network
    // status for that query. See the branch for query initialization for more
    // explanation about this process.
    if (typeof fetchMoreForQueryId === 'string') {
      this.markQueryResultClient(fetchMoreForQueryId, true);
    }
  }

  public markQueryResultClient(queryId: string, complete: boolean) {
    const storeValue = this.store && this.store[queryId];
    if (storeValue) {
      storeValue.networkError = null;
      storeValue.previousVariables = null;
      if (complete) {
        storeValue.networkStatus = NetworkStatus.ready;
      }
    }
  }

  public stopQuery(queryId: string) {
    delete this.store[queryId];
  }

  public reset(observableQueryIds: string[]) {
    Object.keys(this.store).forEach(queryId => {
      if (observableQueryIds.indexOf(queryId) < 0) {
        this.stopQuery(queryId);
      } else {
        // XXX set loading to true so listeners don't trigger unless they want results with partial data
        this.store[queryId].networkStatus = NetworkStatus.loading;
      }
    });
  }
}
