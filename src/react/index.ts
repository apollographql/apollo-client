export type { ApolloContextValue } from "./context/index.js";
export {
  ApolloConsumer,
  ApolloProvider,
  getApolloContext,
} from "./context/index.js";

export * from "./hooks/index.js";

export type { IDocumentDefinition } from "./parser/index.js";
export { DocumentType, operationName, parser } from "./parser/index.js";

export type {
  PreloadQueryFetchPolicy,
  PreloadQueryFunction,
  PreloadQueryOptions,
} from "./query-preloader/createQueryPreloader.js";
export { createQueryPreloader } from "./query-preloader/createQueryPreloader.js";

export type {
  PreloadedQueryRef,
  QueryRef,
  QueryReference,
} from "./internal/index.js";

// These types will be removed with v5
export type * from "./types/deprecated.js";
