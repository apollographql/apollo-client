export type { FragmentMap } from "./types/FragmentMap.js";
export type { FragmentMapFunction } from "./types/FragmentMapFunction.js";

export { argumentsObjectFromField } from "./argumentsObjectFromField.js";
export { checkDocument } from "./checkDocument.js";
export { createFragmentMap } from "./createFragmentMap.js";
export { getFragmentFromSelection } from "./getFragmentFromSelection.js";
export { getFragmentQueryDocument } from "./getFragmentQueryDocument.js";
export { hasClientExports } from "./hasClientExports.js";
export { hasDirectives } from "./hasDirectives.js";
export { onAnyEvent } from "./onAnyEvent.js";
export { shouldInclude } from "./shouldInclude.js";
export { toQueryResult } from "./toQueryResult.js";

export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";

export {
  getDefaultValues,
  getFragmentDefinition,
  getFragmentDefinitions,
  getMainDefinition,
  getOperationDefinition,
  getOperationName,
  getQueryDefinition,
} from "./graphql/getFromAST.js";

export {
  removeClientSetsFromDocument,
  removeDirectivesFromDocument,
} from "./graphql/transform.js";
