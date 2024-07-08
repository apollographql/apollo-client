import type { GraphQLFormattedError } from "graphql";
import type { DocumentNode } from "graphql";
import type { DefaultContext } from "../../core/index.js";
export type { DocumentNode };

import type { Observable } from "../../utilities/index.js";

export type Path = ReadonlyArray<string | number>;

interface ExecutionPatchResultBase {
  hasNext?: boolean;
}

export interface ExecutionPatchInitialResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> extends ExecutionPatchResultBase {
  // if data is present, incremental is not
  data: TData | null | undefined;
  incremental?: never;
  errors?: ReadonlyArray<GraphQLFormattedError>;
  extensions?: TExtensions;
}

export interface IncrementalPayload<TData, TExtensions> {
  // data and path must both be present
  // https://github.com/graphql/graphql-spec/pull/742/files#diff-98d0cd153b72b63c417ad4238e8cc0d3385691ccbde7f7674bc0d2a718b896ecR288-R293
  data: TData | null;
  label?: string;
  path: Path;
  errors?: ReadonlyArray<GraphQLFormattedError>;
  extensions?: TExtensions;
}

export interface ExecutionPatchIncrementalResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> extends ExecutionPatchResultBase {
  // the reverse is also true: if incremental is present,
  // data (and errors and extensions) are not
  incremental?: IncrementalPayload<TData, TExtensions>[];
  data?: never;
  // Errors only exist for chunks, not at the top level
  // https://github.com/robrichard/defer-stream-wg/discussions/50#discussioncomment-3466739
  errors?: never;
  extensions?: never;
}

export interface ApolloPayloadResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> {
  payload: SingleExecutionResult | ExecutionPatchResult | null;
  // Transport layer errors (as distinct from GraphQL or NetworkErrors),
  // these are fatal errors that will include done: true.
  errors?: ReadonlyArray<Error | string>;
}

export type ExecutionPatchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> =
  | ExecutionPatchInitialResult<TData, TExtensions>
  | ExecutionPatchIncrementalResult<TData, TExtensions>;

export interface GraphQLRequest<TVariables = Record<string, any>> {
  query: DocumentNode;
  variables?: TVariables;
  operationName?: string;
  context?: DefaultContext;
  extensions?: Record<string, any>;
}

export interface Operation {
  query: DocumentNode;
  variables: Record<string, any>;
  operationName: string;
  extensions: Record<string, any>;
  setContext: {
    (context: Partial<DefaultContext>): void;
    (
      updateContext: (
        previousContext: DefaultContext
      ) => Partial<DefaultContext>
    ): void;
  };
  getContext: () => DefaultContext;
}

export interface SingleExecutionResult<
  TData = Record<string, any>,
  TContext = DefaultContext,
  TExtensions = Record<string, any>,
> {
  // data might be undefined if errorPolicy was set to 'ignore'
  data?: TData | null;
  context?: TContext;
  errors?: ReadonlyArray<GraphQLFormattedError>;
  extensions?: TExtensions;
}

export type FetchResult<
  TData = Record<string, any>,
  TContext = Record<string, any>,
  TExtensions = Record<string, any>,
> =
  | SingleExecutionResult<TData, TContext, TExtensions>
  | ExecutionPatchResult<TData, TExtensions>;

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink
) => Observable<FetchResult> | null;
