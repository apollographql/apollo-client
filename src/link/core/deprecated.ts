import type { ApolloLink } from "./ApolloLink.js";

/** @deprecated Use `ApolloLink.Request` instead */
export type GraphQLRequest = ApolloLink.Request;

/** @deprecated Use `ApolloLink.Operation` instead */
export type Operation = ApolloLink.Operation;

/** @deprecated Use `ApolloLink.RequestHandler` instead */
export type RequestHandler = ApolloLink.RequestHandler;

/** @deprecated Use `ApolloLink.Result` instead */
export type FetchResult<
  TData = Record<string, any>,
  TExtensions = Record<string, any>,
> = ApolloLink.Result<TData, TExtensions>;
