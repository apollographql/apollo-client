import {
  ApolloAction,
  isQueryInitAction,
  isQueryResultAction,
  isQueryErrorAction,
  isQueryResultClientAction,
  isQueryStopAction,
  isStoreResetAction,
  StoreResetAction,
} from '../actions';

import {
  graphQLResultHasError,
} from '../data/storeUtils';

import {
  DocumentNode,
  SelectionSetNode,
  GraphQLError,
} from 'graphql';

import { isEqual } from '../util/isEqual';

import { NetworkStatus } from './networkStatus';

export interface QueryStore {
  [queryId: string]: QueryStoreValue;
}

export type QueryStoreValue = {
  queryString: string;
  document: DocumentNode;
  variables: Object;
  previousVariables: Object | null;
  networkStatus: NetworkStatus;
  networkError: Error | null;
  graphQLErrors: GraphQLError[];
  lastRequestId: number;
  metadata: any;
};

export interface SelectionSetWithRoot {
  id: string;
  typeName: string;
  selectionSet: SelectionSetNode;
}

export function queries(
  previousState: QueryStore = {},
  action: ApolloAction,
): QueryStore {
  if (isQueryInitAction(action)) {
    const newState = { ...previousState } as QueryStore;

    const previousQuery = previousState[action.queryId];

    if (previousQuery && previousQuery.queryString !== action.queryString) {
      // XXX we're throwing an error here to catch bugs where a query gets overwritten by a new one.
      // we should implement a separate action for refetching so that QUERY_INIT may never overwrite
      // an existing query (see also: https://github.com/apollostack/apollo-client/issues/732)
      throw new Error('Internal Error: may not update existing query string in store');
    }

    let isSetVariables = false;

    let previousVariables: Object | null = null;
    if (
      action.storePreviousVariables &&
      previousQuery &&
      previousQuery.networkStatus !== NetworkStatus.loading
      // if the previous query was still loading, we don't want to remember it at all.
    ) {
      if (!isEqual(previousQuery.variables, action.variables)) {
        isSetVariables = true;
        previousVariables = previousQuery.variables;
      }
    }

    // TODO break this out into a separate function
    let newNetworkStatus = NetworkStatus.loading;

    if (isSetVariables) {
      newNetworkStatus = NetworkStatus.setVariables;
    } else if (action.isPoll) {
      newNetworkStatus = NetworkStatus.poll;
    } else if (action.isRefetch) {
      newNetworkStatus = NetworkStatus.refetch;
      // TODO: can we determine setVariables here if it's a refetch and the variables have changed?
    } else if (action.isPoll) {
      newNetworkStatus = NetworkStatus.poll;
    }

    // XXX right now if QUERY_INIT is fired twice, like in a refetch situation, we just overwrite
    // the store. We probably want a refetch action instead, because I suspect that if you refetch
    // before the initial fetch is done, you'll get an error.
    newState[action.queryId] = {
      queryString: action.queryString,
      document: action.document,
      variables: action.variables,
      previousVariables,
      networkError: null,
      graphQLErrors: [],
      networkStatus: newNetworkStatus,
      lastRequestId: action.requestId,
      metadata: action.metadata,
    };

    // If the action had a `moreForQueryId` property then we need to set the
    // network status on that query as well to `fetchMore`.
    //
    // We have a complement to this if statement in the query result and query
    // error action branch, but importantly *not* in the client result branch.
    // This is because the implementation of `fetchMore` *always* sets
    // `fetchPolicy` to `network-only` so we would never have a client result.
    if (typeof action.fetchMoreForQueryId === 'string') {
      newState[action.fetchMoreForQueryId] = {
        // We assume that that both a query with id `action.moreForQueryId`
        // already exists and that it is not `action.queryId`. This is a safe
        // assumption given how we set `moreForQueryId`.
        ...previousState[action.fetchMoreForQueryId],
        // We set the network status to `fetchMore` here overwriting any
        // network status that currently exists. This is how network statuses
        // are set normally, so it makes sense to set it this way here as well.
        networkStatus: NetworkStatus.fetchMore,
      };
    }

    return newState;
  } else if (isQueryResultAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    if (action.requestId < previousState[action.queryId].lastRequestId) {
      return previousState;
    }

    const newState = { ...previousState } as QueryStore;
    const resultHasGraphQLErrors = graphQLResultHasError(action.result);

    newState[action.queryId] = {
      ...previousState[action.queryId],
      networkError: null,
      graphQLErrors: resultHasGraphQLErrors ? action.result.errors : [],
      previousVariables: null,
      networkStatus: NetworkStatus.ready,
    };

    // If we have a `fetchMoreForQueryId` then we need to update the network
    // status for that query. See the branch for query initialization for more
    // explanation about this process.
    if (typeof action.fetchMoreForQueryId === 'string') {
      newState[action.fetchMoreForQueryId] = {
        ...previousState[action.fetchMoreForQueryId],
        networkStatus: NetworkStatus.ready,
      };
    }

    return newState;
  } else if (isQueryErrorAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    if (action.requestId < previousState[action.queryId].lastRequestId) {
      return previousState;
    }

    const newState = { ...previousState } as QueryStore;

    newState[action.queryId] = {
      ...previousState[action.queryId],
      networkError: action.error,
      networkStatus: NetworkStatus.error,
    };

    // If we have a `fetchMoreForQueryId` then we need to update the network
    // status for that query. See the branch for query initialization for more
    // explanation about this process.
    if (typeof action.fetchMoreForQueryId === 'string') {
      newState[action.fetchMoreForQueryId] = {
        ...previousState[action.fetchMoreForQueryId],
        networkError: action.error,
        networkStatus: NetworkStatus.error,
      };
    }

    return newState;
  } else if (isQueryResultClientAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    const newState = { ...previousState } as QueryStore;

    newState[action.queryId] = {
      ...previousState[action.queryId],
      networkError: null,
      previousVariables: null,
      // XXX I'm not sure what exactly action.complete really means. I assume it means we have the complete result
      // and do not need to hit the server. Not sure when we'd fire this action if the result is not complete, so that bears explanation.
      // We should write that down somewhere.
      networkStatus: action.complete ? NetworkStatus.ready : NetworkStatus.loading,
    };

    return newState;
  } else if (isQueryStopAction(action)) {
    const newState = { ...previousState } as QueryStore;

    delete newState[action.queryId];
    return newState;
  } else if (isStoreResetAction(action)) {
    return resetQueryState(previousState, action);
  }

  return previousState;
}

// Returns the new query state after we receive a store reset action.
// Note that we don't remove the query state for the query IDs that are associated with watchQuery()
// observables. This is because these observables are simply refetched and not
// errored in the event of a store reset.
function resetQueryState(state: QueryStore, action: StoreResetAction): QueryStore {
  const observableQueryIds = action.observableQueryIds;

  // keep only the queries with query ids that are associated with observables
  const newQueries = Object.keys(state).filter((queryId) => {
    return (observableQueryIds.indexOf(queryId) > -1);
  }).reduce((res, key) => {
    // XXX set loading to true so listeners don't trigger unless they want results with partial data
    res[key] = {
      ...state[key],
      networkStatus: NetworkStatus.loading,
    };

    return res;
  }, {} as QueryStore);

  return newQueries;
}
