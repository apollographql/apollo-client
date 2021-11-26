import { DocumentNode, ExecutionResult } from 'graphql';
export { DocumentNode };

import { Observable } from '../../utilities';

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
> extends ExecutionResult<TData, TExtensions> {
  data?: TData | null | undefined;
  extensions?: TExtensions;
  context?: TContext;
};

export type NextLink = (operation: Operation) => Observable<FetchResult>;

export type RequestHandler = (
  operation: Operation,
  forward: NextLink,
) => Observable<FetchResult> | null;
