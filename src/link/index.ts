export type { DocumentNode } from "graphql";

export { empty } from "./core/empty.js";
export { from } from "./core/from.js";
export { split } from "./core/split.js";
export { concat } from "./core/concat.js";
export { execute } from "./core/execute.js";
export { ApolloLink } from "./core/ApolloLink.js";

export type { ApolloPayloadResult } from "./core/types.js";

export type {
  FetchResult,
  GraphQLRequest,
  Operation,
  RequestHandler,
} from "./core/deprecated.js";
