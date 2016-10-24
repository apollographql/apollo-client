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
  SelectionSet,
  GraphQLError,
} from 'graphql';

import assign = require('lodash.assign');
import isEqual = require('lodash.isequal');

export interface QueryStore {
  [queryId: string]: QueryStoreValue;
}

export enum NetworkStatus {
  loading = 1,
  setVariables = 2,
  fetchMore = 3,
  refetch = 4,
  poll = 6,
  ready = 7,
  error = 8,
}

export type QueryStoreValue = {
  queryString: string;
  variables: Object;
  previousVariables: Object;
  stopped: boolean;
  loading: boolean;
  networkStatus: NetworkStatus;
  networkError: Error;
  graphQLErrors: GraphQLError[];
  forceFetch: boolean;
  returnPartialData: boolean;
  lastRequestId: number;
}

export interface SelectionSetWithRoot {
  id: string;
  typeName: string;
  selectionSet: SelectionSet;
}

export function queries(
  previousState: QueryStore = {},
  action: ApolloAction
): QueryStore {
  if (isQueryInitAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    const previousQuery = previousState[action.queryId];

    if (previousQuery && previousQuery.queryString !== action.queryString) {
      // XXX we're throwing an error here to catch bugs where a query gets overwritten by a new one.
      // we should implement a separate action for refetching so that QUERY_INIT may never overwrite
      // an existing query (see also: https://github.com/apollostack/apollo-client/issues/732)
      throw new Error('Internal Error: may not update existing query string in store');
    }

    let isSetVariables = false;

    let previousVariables: Object;
    if (action.storePreviousVariables && previousQuery) {
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
      variables: action.variables,
      previousVariables,
      stopped: false,
      loading: true,
      networkError: null,
      graphQLErrors: null,
      networkStatus: newNetworkStatus,
      forceFetch: action.forceFetch,
      returnPartialData: action.returnPartialData,
      lastRequestId: action.requestId,
    };

    return newState;
  } else if (isQueryResultAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    if (action.requestId < previousState[action.queryId].lastRequestId) {
      return previousState;
    }

    const newState = assign({}, previousState) as QueryStore;
    const resultHasGraphQLErrors = graphQLResultHasError(action.result);

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      networkError: null,
      graphQLErrors: resultHasGraphQLErrors ? action.result.errors : null,
      previousVariables: null,
      networkStatus: NetworkStatus.ready,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryErrorAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    // Ignore results from old requests
    if (action.requestId < previousState[action.queryId].lastRequestId) {
      return previousState;
    }

    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      networkError: action.error,
      networkStatus: NetworkStatus.error,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryResultClientAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: !action.complete,
      networkError: null,
      previousVariables: null,
      // XXX I'm not sure what exactly action.complete really means. I assume it means we have the complete result
      // and do not need to hit the server. Not sure when we'd fire this action if the result is not complete, so that bears explanation.
      // We should write that down somewhere.
      networkStatus: action.complete ? NetworkStatus.ready : NetworkStatus.loading,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryStopAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      stopped: true,
      networkStatus: NetworkStatus.ready,
    }) as QueryStoreValue;

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
    res[key] = state[key];
    return res;
  }, {} as QueryStore);

  return newQueries;
}
