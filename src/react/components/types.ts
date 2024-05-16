import type { DocumentNode } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type * as ReactTypes from "react";

import type {
  OperationVariables,
  DefaultContext,
  ApolloCache,
} from "../../core/index.js";
import type {
  QueryFunctionOptions,
  QueryResult,
  BaseMutationOptions,
  MutationFunction,
  MutationResult,
  BaseSubscriptionOptions,
  SubscriptionResult,
} from "../types/types.js";

export interface QueryComponentOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends QueryFunctionOptions<TData, TVariables> {
  children: (
    result: QueryResult<TData, TVariables>
  ) => ReactTypes.JSX.Element | null;
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
}

export interface MutationComponentOptions<
  TData = any,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache<any> = ApolloCache<any>,
> extends BaseMutationOptions<TData, TVariables, TContext, TCache> {
  mutation: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children: (
    mutateFunction: MutationFunction<TData, TVariables, TContext>,
    result: MutationResult<TData>
  ) => ReactTypes.JSX.Element | null;
}

export interface SubscriptionComponentOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> extends BaseSubscriptionOptions<TData, TVariables> {
  /** {@inheritDoc @apollo/client!SubscriptionOptionsDocumentation#query:member} */
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>;
  children?:
    | null
    | ((result: SubscriptionResult<TData>) => ReactTypes.JSX.Element | null);
}
