import {
  DocumentNode,
  ExecutionResult,
} from 'graphql';

import {
  MutationQueryReducer,
} from './data/mutationResults';

import {
  DataProxy,
} from './data/proxy';

import {
  ApolloReducer,
} from './store';

import {
  FetchPolicy,
} from './core/watchQueryOptions';

export type QueryResultAction = {
  type: 'APOLLO_QUERY_RESULT';
  result: ExecutionResult;
  queryId: string;
  document: DocumentNode;
  operationName: string;
  requestId: number;
  fetchMoreForQueryId?: string;
  extraReducers?: ApolloReducer[];
};

export function isQueryResultAction(action: ApolloAction): action is QueryResultAction {
  return action.type === 'APOLLO_QUERY_RESULT';
}

export interface QueryErrorAction {
  type: 'APOLLO_QUERY_ERROR';
  error: Error;
  queryId: string;
  requestId: number;
  fetchMoreForQueryId?: string;
}

export function isQueryErrorAction(action: ApolloAction): action is QueryErrorAction {
  return action.type === 'APOLLO_QUERY_ERROR';
}

export interface QueryInitAction {
  type: 'APOLLO_QUERY_INIT';
  queryString: string;
  document: DocumentNode;
  variables: Object;
  fetchPolicy: FetchPolicy;
  queryId: string;
  requestId: number;
  storePreviousVariables: boolean;
  isRefetch: boolean;
  isPoll: boolean;
  fetchMoreForQueryId?: string;
  metadata: any;
}

export function isQueryInitAction(action: ApolloAction): action is QueryInitAction {
  return action.type === 'APOLLO_QUERY_INIT';
}

export interface QueryResultClientAction {
  type: 'APOLLO_QUERY_RESULT_CLIENT';
  result: ExecutionResult;
  complete: boolean;
  queryId: string;
  requestId: number;
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
  mutation: DocumentNode;
  variables: Object;
  operationName: string;
  mutationId: string;
  optimisticResponse: Object | undefined;
  extraReducers?: ApolloReducer[];
  updateQueries?: { [queryId: string]: MutationQueryReducer };
  update?: (proxy: DataProxy, mutationResult: Object) => void;
}

export function isMutationInitAction(action: ApolloAction): action is MutationInitAction {
  return action.type === 'APOLLO_MUTATION_INIT';
}

// TODO REFACOTR: simplify all these actions by providing a generic options field to all actions.
export interface MutationResultAction {
  type: 'APOLLO_MUTATION_RESULT';
  result: ExecutionResult;
  document: DocumentNode;
  operationName: string;
  variables: Object;
  mutationId: string;
  extraReducers?: ApolloReducer[];
  updateQueries?: { [queryId: string]: MutationQueryReducer };
  update?: (proxy: DataProxy, mutationResult: Object) => void;
}

export function isMutationResultAction(action: ApolloAction): action is MutationResultAction {
  return action.type === 'APOLLO_MUTATION_RESULT';
}

export interface MutationErrorAction {
  type: 'APOLLO_MUTATION_ERROR';
  error: Error;
  mutationId: string;
}

export function isMutationErrorAction(action: ApolloAction): action is MutationErrorAction {
  return action.type === 'APOLLO_MUTATION_ERROR';
}

export interface UpdateQueryResultAction {
  type: 'APOLLO_UPDATE_QUERY_RESULT';
  variables: any;
  document: DocumentNode;
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

export interface SubscriptionResultAction {
  type: 'APOLLO_SUBSCRIPTION_RESULT';
  result: ExecutionResult;
  subscriptionId: number;
  variables: Object;
  document: DocumentNode;
  operationName: string;
  extraReducers?: ApolloReducer[];
}

export function isSubscriptionResultAction(action: ApolloAction): action is SubscriptionResultAction {
  return action.type === 'APOLLO_SUBSCRIPTION_RESULT';
}

export interface DataWrite {
  rootId: string;
  result: any;
  document: DocumentNode;
  variables: Object;
}

export interface WriteAction {
  type: 'APOLLO_WRITE';
  writes: Array<DataWrite>;
}

export function isWriteAction(action: ApolloAction): action is WriteAction {
  return action.type === 'APOLLO_WRITE';
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
  SubscriptionResultAction |
  WriteAction;
