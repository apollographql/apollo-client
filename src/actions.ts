import {
  SelectionSet,
} from 'graphql';

export interface QueryResultAction {
  type: 'QUERY_RESULT';
  result: any;
  selectionSet: SelectionSet;
  variables: Object;
}

export interface QueryInitAction {
  type: 'QUERY_INIT';
  selectionSet: SelectionSet;
  rootId: string;
  typeName: string;
  variables: Object;
  forceFetch: boolean;
  returnPartialData: boolean;
  queryId: string;
}

export function isQueryResultAction(action: ApolloAction): action is QueryResultAction {
  return action.type === 'QUERY_RESULT';
}

export function isQueryInitAction(action: ApolloAction): action is QueryInitAction {
  return action.type === 'QUERY_INIT';
}

export type ApolloAction = QueryResultAction | QueryInitAction;
