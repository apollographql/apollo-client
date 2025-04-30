export type { DeepOmit } from "./types/DeepOmit.js";
export type { DeepPartial } from "./types/DeepPartial.js";
export type { FragmentMap } from "./types/FragmentMap.js";
export type { FragmentMapFunction } from "./types/FragmentMapFunction.js";
export type { Prettify } from "./types/Prettify.js";
export type { Primitive } from "./types/Primitive.js";
export type { NoInfer } from "./types/NoInfer.js";

export { argumentsObjectFromField } from "./argumentsObjectFromField.js";
export { canUseDOM } from "./canUseDOM.js";
export { canUseLayoutEffect } from "./canUseLayoutEffect.js";
export { checkDocument } from "./checkDocument.js";
export { cloneDeep } from "./cloneDeep.js";
export { compact } from "./compact.js";
export { createFragmentMap } from "./createFragmentMap.js";
export { DeepMerger } from "./DeepMerger.js";
export { getDefaultValues } from "./getDefaultValues.js";
export { getFragmentFromSelection } from "./getFragmentFromSelection.js";
export { getFragmentQueryDocument } from "./getFragmentQueryDocument.js";
export { getFragmentDefinition } from "./getFragmentDefinition.js";
export { getFragmentDefinitions } from "./getFragmentDefinitions.js";
export { getGraphQLErrorsFromResult } from "./getGraphQLErrorsFromResult.js";
export { getMainDefinition } from "./getMainDefinition.js";
export { getOperationDefinition } from "./getOperationDefinition.js";
export { getOperationName } from "./getOperationName.js";
export { getQueryDefinition } from "./getQueryDefinition.js";
export { getStoreKeyName } from "./getStoreKeyName.js";
export { graphQLResultHasError } from "./graphQLResultHasError.js";
export { hasClientExports } from "./hasClientExports.js";
export { hasDirectives } from "./hasDirectives.js";
export { isApolloPayloadResult } from "./isApolloPayloadResult.js";
export { isArray } from "./isArray.js";
export { isDocumentNode } from "./isDocumentNode.js";
export { isExecutionPatchIncrementalResult } from "./isExecutionPatchIncrementalResult.js";
export { isExecutionPatchInitialResult } from "./isExecutionPatchIninitialResult.js";
export { isExecutionPatchResult } from "./isExecutionPatchResult.js";
export { isField } from "./isField.js";
export { isInlineFragment } from "./isInlineFragment.js";
export { isNonEmptyArray } from "./isNonEmptyArray.js";
export { isNonNullObject } from "./isNonNullObject.js";
export { isPlainObject } from "./isPlainObject.js";
export { makeReference } from "./makeReference.js";
export { makeUniqueId } from "./makeUniqueId.js";
export { maybeDeepFreeze } from "./maybeDeepFreeze.js";
export { mergeDeep } from "./mergeDeep.js";
export { mergeDeepArray } from "./mergeDeepArray.js";
export { mergeIncrementalData } from "./mergeIncrementalData.js";
export { mergeOptions } from "./mergeOptions.js";
export { omitDeep } from "./omitDeep.js";
export { onAnyEvent } from "./onAnyEvent.js";
export { preventUnhandledRejection } from "./preventUnhandledRejection.js";
export { removeClientSetsFromDocument } from "./removeClientSetsFromDocument.js";
export { removeDirectivesFromDocument } from "./removeDirectivesFromDocument.js";
export { resultKeyNameFromField } from "./resultKeyNameFromField.js";
export { shouldInclude } from "./shouldInclude.js";
export { storeKeyNameFromField } from "./storeKeyNameFromField.js";
export { stringifyForDisplay } from "./stringifyForDisplay.js";
export { toQueryResult } from "./toQueryResult.js";

export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";

export { AutoCleanedStrongCache, AutoCleanedWeakCache } from "./caches.js";
