export { onAnyEvent } from "./observables.js";
export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";
export { toQueryResult } from "./toQueryResult.js";
export {
  addNonReactiveToNamedFragments,
  removeClientSetsFromDocument,
  removeFragmentSpreadFromDocument,
} from "./graphql/transform.js";
