import "../utilities/globals/index.js";

export type { ApolloContextValue } from "./context/index.js";
export {
  ApolloProvider,
  ApolloConsumer,
  getApolloContext,
  resetApolloContext,
} from "./context/index.js";

export * from "./hooks/index.js";

export type { IDocumentDefinition } from "./parser/index.js";
export { DocumentType, operationName, parser } from "./parser/index.js";

export type {
  PreloadQueryOptions,
  PreloadQueryFetchPolicy,
  PreloadQueryFunction,
} from "./query-preloader/createQueryPreloader.js";
export { createQueryPreloader } from "./query-preloader/createQueryPreloader.js";

export * from "./types/types.js";
