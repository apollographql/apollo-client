import {
  Document,
  GraphQLResult,
} from 'graphql';

import {
  MutationBehavior,
} from './data/mutationResults';

import {
  ApolloReducer,
} from './store';

export type QueryResultAction = {
  type: 'APOLLO_QUERY_RESULT';
  result: GraphQLResult;
  queryId: string;
  document: Document;
  operationName: string;
  requestId: number;
  extraReducers?: ApolloReducer[];
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
  document: Document;
  variables: Object;
  forceFetch: boolean;
  returnPartialData: boolean;
  queryId: string;
  requestId: number;
  storePreviousVariables: boolean;
  isRefetch: boolean;
  isPoll: boolean;
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
  mutation: Document;
  variables: Object;
  operationName: string;
  mutationId: string;
  optimisticResponse: Object;
  resultBehaviors?: MutationBehavior[];
  extraReducers?: ApolloReducer[];
}

export function isMutationInitAction(action: ApolloAction): action is MutationInitAction {
  return action.type === 'APOLLO_MUTATION_INIT';
}

// TODO REFACOTR: simplify all these actions by providing a generic options field to all actions.
export interface MutationResultAction {
  type: 'APOLLO_MUTATION_RESULT';
  result: GraphQLResult;
  document: Document;
  operationName: string;
  // XXX maybe provide variables as well?
  mutationId: string;
  resultBehaviors?: MutationBehavior[];
  extraReducers?: ApolloReducer[];
}

export function isMutationResultAction(action: ApolloAction): action is MutationResultAction {
  return action.type === 'APOLLO_MUTATION_RESULT';
}

export interface MutationErrorAction {
  type: 'APOLLO_MUTATION_ERROR';
  error: Error;
  mutationId: string;
};

export function isMutationErrorAction(action: ApolloAction): action is MutationErrorAction {
  return action.type === 'APOLLO_MUTATION_ERROR';
}

export interface UpdateQueryResultAction {
  type: 'APOLLO_UPDATE_QUERY_RESULT';
  variables: any;
  document: Document;
  newResult: Object;
}

export function isUpdateQueryResultAction(action: ApolloAction): action is UpdateQueryResultAction {
  return action.type === 'APOLLO_UPDATE_QUERY_RESULT';
}

export interface StoreResetAction {
  type: 'APOLLO_STORE_RESET';
  observableQueryIds: string[];
}

export function isStoreResetAction(action: ApolloAction): action is StoreResetAction {
  return action.type === 'APOLLO_STORE_RESET';
}

export type SubscriptionResultAction = {
  type: 'APOLLO_SUBSCRIPTION_RESULT';
  result: GraphQLResult;
  subscriptionId: number;
  variables: Object;
  document: Document;
  operationName: string;
  extraReducers?: ApolloReducer[];
}

export function isSubscriptionResultAction(action: ApolloAction): action is SubscriptionResultAction {
  return action.type === 'APOLLO_SUBSCRIPTION_RESULT';
}

export type ApolloAction =
  QueryResultAction |
  QueryErrorAction |
  QueryInitAction |
  QueryResultClientAction |
  QueryStopAction |
  MutationInitAction |
  MutationResultAction |
  MutationErrorAction |
  UpdateQueryResultAction |
  StoreResetAction |
  SubscriptionResultAction;
