export type { FragmentMap } from "./types/FragmentMap.js";
export type { FragmentMapFunction } from "./types/FragmentMapFunction.js";

export { argumentsObjectFromField } from "./argumentsObjectFromField.js";
export { checkDocument } from "./checkDocument.js";
export { createFragmentMap } from "./createFragmentMap.js";
export { getDefaultValues } from "./getDefaultValues.js";
export { getFragmentFromSelection } from "./getFragmentFromSelection.js";
export { getFragmentQueryDocument } from "./getFragmentQueryDocument.js";
export { getFragmentDefinition } from "./getFragmentDefinition.js";
export { getFragmentDefinitions } from "./getFragmentDefinitions.js";
export { getMainDefinition } from "./getMainDefinition.js";
export { getOperationDefinition } from "./getOperationDefinition.js";
export { getOperationName } from "./getOperationName.js";
export { getQueryDefinition } from "./getQueryDefinition.js";
export { getStoreKeyName } from "./getStoreKeyName.js";
export { hasClientExports } from "./hasClientExports.js";
export { hasDirectives } from "./hasDirectives.js";
export { isArray } from "./isArray.js";
export { isDocumentNode } from "./isDocumentNode.js";
export { isField } from "./isField.js";
export { isInlineFragment } from "./isInlineFragment.js";
export { isNonEmptyArray } from "./isNonEmptyArray.js";
export { isNonNullObject } from "./isNonNullObject.js";
export { isPlainObject } from "./isPlainObject.js";
export { makeReference } from "./makeReference.js";
export { onAnyEvent } from "./onAnyEvent.js";
export { preventUnhandledRejection } from "./preventUnhandledRejection.js";
export { removeClientSetsFromDocument } from "./removeClientSetsFromDocument.js";
export { removeDirectivesFromDocument } from "./removeDirectivesFromDocument.js";
export { resultKeyNameFromField } from "./resultKeyNameFromField.js";
export { shouldInclude } from "./shouldInclude.js";
export { storeKeyNameFromField } from "./storeKeyNameFromField.js";
export { toQueryResult } from "./toQueryResult.js";

export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";
