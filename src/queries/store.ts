import {
  ApolloAction,
  isQueryInitAction,
  isQueryResultAction,
  isQueryErrorAction,
  isQueryResultClientAction,
  isQueryStopAction,
} from '../actions';

import {
  SelectionSet,
  GraphQLError,
} from 'graphql';

import {
  assign,
} from 'lodash';

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
    };

    return newState;
  } else if (isQueryResultAction(action)) {
    const newState = assign({}, previousState) as QueryStore;
    const resultHasGraphQLErrors = action.result.errors && action.result.errors.length;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      networkError: null,
      graphQLErrors: resultHasGraphQLErrors ? action.result.errors : null,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryErrorAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      networkError: action.error,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryResultClientAction(action)) {
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
