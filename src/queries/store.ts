import {
  ApolloAction,
  isQueryInitAction,
  isQueryResultAction,
  isQueryResultClientAction,
} from '../actions';

import {
  SelectionSet,
  GraphQLResult,
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
  error: Error;
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
      error: null,
      forceFetch: action.forceFetch,
      returnPartialData: action.returnPartialData,
    };

    return newState;
  } else if (isQueryResultAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: false,
      error: null,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryResultClientAction(action)) {
    const newState = assign({}, previousState) as QueryStore;

    newState[action.queryId] = assign({}, previousState[action.queryId], {
      loading: action.complete,
      error: null,
    }) as QueryStoreValue;

    return newState;
  }

  return previousState;
}
