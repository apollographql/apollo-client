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

export type { FragmentMap, FragmentMapFunction } from "./graphql/fragments.js";
export {
  createFragmentMap,
  getFragmentFromSelection,
  getFragmentQueryDocument,
} from "./graphql/fragments.js";

export { checkDocument } from "./graphql/getFromAST.js";

export {
  addNonReactiveToNamedFragments,
  removeClientSetsFromDocument,
  removeDirectivesFromDocument,
  removeFragmentSpreadFromDocument,
} from "./graphql/transform.js";
