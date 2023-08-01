import "../utilities/globals/index.js";

export type { ApolloContextValue } from "./context/index.js";
export {
  ApolloProvider,
  ApolloConsumer,
  getApolloContext,
  resetApolloContext,
} from "./context/index.js";

export * from "./hooks/index.js";
// TODO: remove export with release 3.8
export { SuspenseCache } from "./cache/index.js";

export type { IDocumentDefinition } from "./parser/index.js";
export { DocumentType, operationName, parser } from "./parser/index.js";

export * from "./types/types.js";
