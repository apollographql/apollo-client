export { onAnyEvent } from "./observables.js";
export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";
export { toQueryResult } from "./toQueryResult.js";
export {
  hasClientExports,
  hasDirectives,
  shouldInclude,
} from "./graphql/directives.js";
export { getFragmentQueryDocument } from "./graphql/fragments.js";
export {
  addNonReactiveToNamedFragments,
  removeClientSetsFromDocument,
  removeDirectivesFromDocument,
  removeFragmentSpreadFromDocument,
} from "./graphql/transform.js";
