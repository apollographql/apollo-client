import {
  GraphQLResult,
} from 'graphql';

import {
  SelectionSetWithRoot,
} from './queries/store';

export interface QueryResultAction {
  type: 'APOLLO_QUERY_RESULT';
  result: GraphQLResult;
  queryId: string;
  requestId: number;
}

export function isQueryResultAction(action: ApolloAction): action is QueryResultAction {
  return action.type === 'APOLLO_QUERY_RESULT';
}

export interface QueryErrorAction {
  type: 'APOLLO_QUERY_ERROR';
  error: Error;
  queryId: string;
  requestId: number;
}

export function isQueryErrorAction(action: ApolloAction): action is QueryErrorAction {
  return action.type === 'APOLLO_QUERY_ERROR';
}

export interface QueryInitAction {
  type: 'APOLLO_QUERY_INIT';
  queryString: string;
  query: SelectionSetWithRoot;
  minimizedQueryString: string;
  minimizedQuery: SelectionSetWithRoot;
  variables: Object;
  forceFetch: boolean;
  returnPartialData: boolean;
  queryId: string;
  requestId: number;
}

export function isQueryInitAction(action: ApolloAction): action is QueryInitAction {
  return action.type === 'APOLLO_QUERY_INIT';
}

export interface QueryResultClientAction {
  type: 'APOLLO_QUERY_RESULT_CLIENT';
  result: GraphQLResult;
  complete: boolean;
  queryId: string;
}

export function isQueryResultClientAction(action: ApolloAction): action is QueryResultClientAction {
  return action.type === 'APOLLO_QUERY_RESULT_CLIENT';
}

export interface QueryStopAction {
  type: 'APOLLO_QUERY_STOP';
  queryId: string;
}

export function isQueryStopAction(action: ApolloAction): action is QueryStopAction {
  return action.type === 'APOLLO_QUERY_STOP';
}

export interface MutationInitAction {
  type: 'APOLLO_MUTATION_INIT';
  mutationString: string;
  mutation: SelectionSetWithRoot;
  variables: Object;
  mutationId: string;
}

export function isMutationInitAction(action: ApolloAction): action is MutationInitAction {
  return action.type === 'APOLLO_MUTATION_INIT';
}

export interface MutationResultAction {
  type: 'APOLLO_MUTATION_RESULT';
  result: GraphQLResult;
  mutationId: string;
}

export function isMutationResultAction(action: ApolloAction): action is MutationResultAction {
  return action.type === 'APOLLO_MUTATION_RESULT';
}

export type ApolloAction =
  QueryResultAction |
  QueryErrorAction |
  QueryInitAction |
  QueryResultClientAction |
  QueryStopAction |
  MutationInitAction |
  MutationResultAction;
