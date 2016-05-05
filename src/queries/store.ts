import {
  ApolloAction,
  isQueryInitAction,
  isQueryResultAction,
  isQueryErrorAction,
  isQueryResultClientAction,
  isQueryStopAction,
} from '../actions';

import {
  graphQLResultHasError,
} from '../data/storeUtils';

import {
  SelectionSet,
  GraphQLError,
} from 'graphql';

import assign = require('lodash.assign');

export interface QueryStore {
  [queryId: string]: QueryStoreValue;
}

export interface QueryStoreValue {
  queryString: string;
  query: SelectionSetWithRoot;
  minimizedQueryString: string;
  minimizedQuery: SelectionSetWithRoot;
  variables: Object;
  loading: boolean;
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

    // XXX right now if QUERY_INIT is fired twice, like in a refetch situation, we just overwrite
    // the store. We probably want a refetch action instead, because I suspect that if you refetch
    // before the initial fetch is done, you'll get an error.
    newState[action.queryId] = {
      queryString: action.queryString,
      query: action.query,
      minimizedQueryString: action.minimizedQueryString,
      minimizedQuery: action.minimizedQuery,
      variables: action.variables,
      loading: true,
      networkError: null,
      graphQLErrors: null,
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
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryStopAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    delete newState[action.queryId];

    return newState;
  }

  return previousState;
}
