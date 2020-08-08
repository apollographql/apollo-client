import { DocumentNode } from 'graphql';

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
  query: DocumentNode;
}

export interface MutationComponentOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseMutationOptions<TData, TVariables> {
  mutation: DocumentNode;
  children: (
    mutateFunction: MutationFunction<TData, TVariables>,
    result: MutationResult<TData>
  ) => JSX.Element | null;
}

export interface SubscriptionComponentOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseSubscriptionOptions<TData, TVariables> {
  subscription: DocumentNode;
  children?: null | ((result: SubscriptionResult<TData>) => JSX.Element | null);
}
