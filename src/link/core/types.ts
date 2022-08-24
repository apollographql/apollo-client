import { DocumentNode, ExecutionResult, GraphQLError } from "graphql";
export { DocumentNode };

import { Observable } from "../../utilities";

export type Path = ReadonlyArray<string | number>;

export interface ExecutionPatchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>
> extends ExecutionResult {
  incremental?: {
    // data and path must be present
    // https://github.com/graphql/graphql-spec/pull/742/files#diff-98d0cd153b72b63c417ad4238e8cc0d3385691ccbde7f7674bc0d2a718b896ecR288-R293
    data: TData | null;
    path: Path;
    errors?: ReadonlyArray<GraphQLError>;
    extensions?: TExtensions;
  }[];
  path?: Path;
  label?: string;
  hasNext?: boolean;
}

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

export interface FetchResult<
  TData = Record<string, any>,
  TContext = Record<string, any>,
  TExtensions = Record<string, any>
> extends Omit<ExecutionPatchResult, "data" | "extensions"> {
  data?: TData | null | undefined;
  extensions?: TExtensions;
  context?: TContext;
}

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink
) => Observable<FetchResult> | null;
