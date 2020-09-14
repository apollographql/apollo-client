import { DocumentNode } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import { OperationVariables } from '../../core';
import {
  QueryFunctionOptions,
  QueryResult,
  BaseMutationOptions,
  MutationFunction,
  MutationResult,
  BaseSubscriptionOptions,
  SubscriptionResult
} from '../types/types';

export interface QueryComponentOptions<
  TData = any,
  TVariables = OperationVariables
> extends QueryFunctionOptions<TData, TVariables> {
  children: (result: QueryResult<TData, TVariables>) => JSX.Element | null;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface MutationComponentOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseMutationOptions<TData, TVariables> {
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children: (
    mutateFunction: MutationFunction<TData, TVariables>,
    result: MutationResult<TData>
  ) => JSX.Element | null;
}

export interface SubscriptionComponentOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?: null | ((result: SubscriptionResult<TData>) => JSX.Element | null);
}
