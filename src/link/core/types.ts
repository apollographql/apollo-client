import { DocumentNode, ExecutionResult, GraphQLError } from "graphql";
export { DocumentNode };

import { Observable } from "../../utilities";

export type Path = ReadonlyArray<string | number>;
type Data<T> = T | null | undefined;

export type ExecutionPatchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>
> = (
  | {
      errors?: ReadonlyArray<GraphQLError>;
      extensions?: TExtensions;
      // if data is present, incremental is not
      incremental?: never;
    }
  | {
      incremental?: {
        // data and path must both be present
        // https://github.com/graphql/graphql-spec/pull/742/files#diff-98d0cd153b72b63c417ad4238e8cc0d3385691ccbde7f7674bc0d2a718b896ecR288-R293
        data?: Data<TData>;
        path: Path;
        errors?: ReadonlyArray<GraphQLError>;
        extensions?: TExtensions;
      }[];
      // Errors only exist for chunks, not at the top level
      // https://github.com/robrichard/defer-stream-wg/discussions/50#discussioncomment-3466739
      errors?: never;
      extensions?: never;
    }
  ) & {
  data?: Data<TData>;
  label?: string;
  hasNext?: boolean;
};

export interface GraphQLRequest {
  query: DocumentNode;
  variables?: Record<string, any>;
  operationName?: string;
  context?: Record<string, any>;
  extensions?: Record<string, any>;
}

export interface Operation {
  query: DocumentNode;
  variables: Record<string, any>;
  operationName: string;
  extensions: Record<string, any>;
  setContext: (context: Record<string, any>) => Record<string, any>;
  getContext: () => Record<string, any>;
}

export interface SingleExecutionResult<
  TData = Record<string, any>,
  TContext = Record<string, any>,
  TExtensions = Record<string, any>
> extends ExecutionResult<TData, TExtensions> {
  data?: Data<TData>;
  context?: TContext;
}

export type FetchResult<
  TData = Record<string, any>,
  TContext = Record<string, any>,
  TExtensions = Record<string, any>
> =
  | SingleExecutionResult<TData, TContext, TExtensions>
  | ExecutionPatchResult<TData, TExtensions>;

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink
) => Observable<FetchResult> | null;
