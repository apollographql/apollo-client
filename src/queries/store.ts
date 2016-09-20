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
  FragmentMap,
} from '../queries/getFromAST';

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

export interface QueryStoreValue {
  queryString: string;
  query: SelectionSetWithRoot;
  minimizedQueryString: string;
  minimizedQuery: SelectionSetWithRoot;
  variables: Object;
  previousVariables: Object;
  loading: boolean;
  networkError: Error;
  graphQLErrors: GraphQLError[];
  forceFetch: boolean;
  returnPartialData: boolean;
  lastRequestId: number;
  fragmentMap: FragmentMap;
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
    let previousVariables: Object;
    if (action.storePreviousVariables && previousQuery) {
      if (!isEqual(previousQuery.variables, action.variables)) {
        previousVariables = previousQuery.variables;
      }
    }

    // XXX right now if QUERY_INIT is fired twice, like in a refetch situation, we just overwrite
    // the store. We probably want a refetch action instead, because I suspect that if you refetch
    // before the initial fetch is done, you'll get an error.
    newState[action.queryId] = {
      queryString: action.queryString,
      query: action.query,
      minimizedQueryString: action.minimizedQueryString,
      minimizedQuery: action.minimizedQuery,
      variables: action.variables,
      previousVariables,
      loading: true,
      networkError: null,
      graphQLErrors: null,
      forceFetch: action.forceFetch,
      returnPartialData: action.returnPartialData,
      lastRequestId: action.requestId,
      fragmentMap: action.fragmentMap,
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
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryResultClientAction(action)) {
    if (!previousState[action.queryId]) {
      return previousState;
    }

    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: action.complete,
      networkError: null,
      previousVariables: null,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryStopAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

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
    res[key] = state[key];
    return res;
  }, {} as QueryStore);

  return newQueries;
}
