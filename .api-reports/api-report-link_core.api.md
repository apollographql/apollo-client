## API Report File for "@apollo/client"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import type { DocumentNode } from 'graphql';
import type { GraphQLFormattedError } from 'graphql';
import { Observable } from 'zen-observable-ts';
import type { Observer } from 'zen-observable-ts';

// @public (undocumented)
export class ApolloLink {
    constructor(request?: RequestHandler);
    // (undocumented)
    static concat(first: ApolloLink | RequestHandler, second: ApolloLink | RequestHandler): ApolloLink;
    // (undocumented)
    concat(next: ApolloLink | RequestHandler): ApolloLink;
    // (undocumented)
    static empty(): ApolloLink;
    // (undocumented)
    static execute(link: ApolloLink, operation: GraphQLRequest): Observable<FetchResult>;
    // (undocumented)
    static from(links: (ApolloLink | RequestHandler)[]): ApolloLink;
    // @internal
    getMemoryInternals?: () => unknown;
    // @internal
    readonly left?: ApolloLink;
    // (undocumented)
    protected onError(error: any, observer?: Observer<FetchResult>): false | void;
    // (undocumented)
    request(operation: Operation, forward?: NextLink): Observable<FetchResult> | null;
    // @internal
    readonly right?: ApolloLink;
    // (undocumented)
    setOnError(fn: ApolloLink["onError"]): this;
    // (undocumented)
    static split(test: (op: Operation) => boolean, left: ApolloLink | RequestHandler, right?: ApolloLink | RequestHandler): ApolloLink;
    // (undocumented)
    split(test: (op: Operation) => boolean, left: ApolloLink | RequestHandler, right?: ApolloLink | RequestHandler): ApolloLink;
}

// @public (undocumented)
export interface ApolloPayloadResult<TData = Record<string, any>, TExtensions = Record<string, any>> {
    // (undocumented)
    errors?: ReadonlyArray<GraphQLFormattedError>;
    // Warning: (ae-forgotten-export) The symbol "DefaultContext" needs to be exported by the entry point index.d.ts
    //
    // (undocumented)
    payload: SingleExecutionResult<TData, DefaultContext, TExtensions> | ExecutionPatchResult<TData, TExtensions> | null;
}

// @public (undocumented)
export const concat: typeof ApolloLink.concat;

// @public (undocumented)
interface DefaultContext extends Record<string, any> {
}

export { DocumentNode }

// @public (undocumented)
export const empty: typeof ApolloLink.empty;

// @public (undocumented)
export const execute: typeof ApolloLink.execute;

// Warning: (ae-forgotten-export) The symbol "ExecutionPatchResultBase" needs to be exported by the entry point index.d.ts
//
// @public (undocumented)
export interface ExecutionPatchIncrementalResult<TData = Record<string, any>, TExtensions = Record<string, any>> extends ExecutionPatchResultBase {
    // (undocumented)
    data?: never;
    // (undocumented)
    errors?: never;
    // (undocumented)
    extensions?: never;
    // (undocumented)
    incremental?: IncrementalPayload<TData, TExtensions>[];
}

// @public (undocumented)
export interface ExecutionPatchInitialResult<TData = Record<string, any>, TExtensions = Record<string, any>> extends ExecutionPatchResultBase {
    // (undocumented)
    data: TData | null | undefined;
    // (undocumented)
    errors?: ReadonlyArray<GraphQLFormattedError>;
    // (undocumented)
    extensions?: TExtensions;
    // (undocumented)
    incremental?: never;
}

// @public (undocumented)
export type ExecutionPatchResult<TData = Record<string, any>, TExtensions = Record<string, any>> = ExecutionPatchInitialResult<TData, TExtensions> | ExecutionPatchIncrementalResult<TData, TExtensions>;

// @public (undocumented)
interface ExecutionPatchResultBase {
    // (undocumented)
    hasNext?: boolean;
}

// @public (undocumented)
export type FetchResult<TData = Record<string, any>, TContext = Record<string, any>, TExtensions = Record<string, any>> = SingleExecutionResult<TData, TContext, TExtensions> | ExecutionPatchResult<TData, TExtensions>;

// @public (undocumented)
export const from: typeof ApolloLink.from;

// @public (undocumented)
export interface GraphQLRequest<TVariables = Record<string, any>> {
    // (undocumented)
    context?: DefaultContext;
    // (undocumented)
    extensions?: Record<string, any>;
    // (undocumented)
    operationName?: string;
    // (undocumented)
    query: DocumentNode;
    // (undocumented)
    variables?: TVariables;
}

// @public (undocumented)
export interface IncrementalPayload<TData, TExtensions> {
    // (undocumented)
    data: TData | null;
    // (undocumented)
    errors?: ReadonlyArray<GraphQLFormattedError>;
    // (undocumented)
    extensions?: TExtensions;
    // (undocumented)
    label?: string;
    // (undocumented)
    path: Path;
}

// @public (undocumented)
export type NextLink = (operation: Operation) => Observable<FetchResult>;

// @public (undocumented)
export interface Operation {
    // (undocumented)
    extensions: Record<string, any>;
    // (undocumented)
    getContext: () => DefaultContext;
    // (undocumented)
    operationName: string;
    // (undocumented)
    query: DocumentNode;
    // (undocumented)
    setContext: {
        (context: Partial<DefaultContext>): void;
        (updateContext: (previousContext: DefaultContext) => Partial<DefaultContext>): void;
    };
    // (undocumented)
    variables: Record<string, any>;
}

// @public (undocumented)
export type Path = ReadonlyArray<string | number>;

// @public (undocumented)
export type RequestHandler = (operation: Operation, forward: NextLink) => Observable<FetchResult> | null;

// @public (undocumented)
export interface SingleExecutionResult<TData = Record<string, any>, TContext = DefaultContext, TExtensions = Record<string, any>> {
    // (undocumented)
    context?: TContext;
    // (undocumented)
    data?: TData | null;
    // (undocumented)
    errors?: ReadonlyArray<GraphQLFormattedError>;
    // (undocumented)
    extensions?: TExtensions;
}

// @public (undocumented)
export const split: typeof ApolloLink.split;

// (No @packageDocumentation comment for this package)

```
