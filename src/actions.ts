import {
  GraphQLResult,
} from 'graphql';

import {
  SelectionSetWithRoot,
} from './queries/store';

export interface QueryResultAction {
  type: 'QUERY_RESULT';
  result: GraphQLResult;
  queryId: string;
}

export function isQueryResultAction(action: ApolloAction): action is QueryResultAction {
  return action.type === 'QUERY_RESULT';
}

export interface QueryInitAction {
  type: 'QUERY_INIT';
  queryString: string;
  query: SelectionSetWithRoot;
  minimizedQueryString: string;
  minimizedQuery: SelectionSetWithRoot;
  variables: Object;
  forceFetch: boolean;
  returnPartialData: boolean;
  queryId: string;
}

export function isQueryInitAction(action: ApolloAction): action is QueryInitAction {
  return action.type === 'QUERY_INIT';
}

export interface QueryResultClientAction {
  type: 'QUERY_RESULT_CLIENT';
  result: GraphQLResult;
  complete: boolean;
  queryId: string;
}

export function isQueryResultClientAction(action: ApolloAction): action is QueryResultClientAction {
  return action.type === 'QUERY_RESULT_CLIENT';
}

export type ApolloAction = QueryResultAction | QueryInitAction | QueryResultClientAction;
