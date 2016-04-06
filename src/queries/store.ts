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
  result: GraphQLResult;
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
  const newState = assign({}, previousState) as QueryStore;

  if (isQueryInitAction(action)) {
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
      result: null,
    };

    return newState;
  } else if (isQueryResultAction(action)) {
    newState[action.queryId] = assign({}, previousState[action.queryId], {
      result: action.result,
      loading: false,
      error: null,
    }) as QueryStoreValue;

    return newState;
  } else if (isQueryResultClientAction(action)) {
    newState[action.queryId] = assign({}, previousState[action.queryId], {
      result: action.result,
      loading: action.complete,
    }) as QueryStoreValue;

    return newState;
  }

  return previousState;
}
