import { DocumentNode, GraphQLError } from 'graphql';
export { DocumentNode };

import { Observable } from '../../utilities';

// Copied from https://github.com/graphql/graphql-js/blob/1012e3e481d3b03ab92fb59a05b73a8b867f13d5/src/execution/execute.d.ts
export interface ExecutionResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface ExecutionPatchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
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
> extends ExecutionPatchResult {
  data?: TData | null;
  context?: TContext;
  extensions?: TExtensions;
};

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink,
) => Observable<FetchResult> | null;
