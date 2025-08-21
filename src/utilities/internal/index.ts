export type { DecoratedPromise } from "./types/DecoratedPromise.js";
export type { DeepOmit } from "./types/DeepOmit.js";
export type { FragmentMap } from "./types/FragmentMap.js";
export type { FragmentMapFunction } from "./types/FragmentMapFunction.js";
export type { FulfilledPromise } from "./types/FulfilledPromise.js";
export type { IsAny } from "./types/IsAny.js";
export type { NoInfer } from "./types/NoInfer.js";
export type { PendingPromise } from "./types/PendingPromise.js";
export type { Prettify } from "./types/Prettify.js";
export type { Primitive } from "./types/Primitive.js";
export type { RejectedPromise } from "./types/RejectedPromise.js";
export type { RemoveIndexSignature } from "./types/RemoveIndexSignature.js";
export type { VariablesOption } from "./types/VariablesOption.js";
export type { DocumentationTypes } from "./types/DocumentationTypes.js";

export { argumentsObjectFromField } from "./argumentsObjectFromField.js";
export { canUseDOM } from "./canUseDOM.js";
export { checkDocument } from "./checkDocument.js";
export { cloneDeep } from "./cloneDeep.js";
export { compact } from "./compact.js";
export { createFragmentMap } from "./createFragmentMap.js";
export { createFulfilledPromise } from "./createFulfilledPromise.js";
export { createRejectedPromise } from "./createRejectedPromise.js";
export { dealias } from "./dealias.js";
export { decoratePromise } from "./decoratePromise.js";
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
export { hasDirectives } from "./hasDirectives.js";
export { hasForcedResolvers } from "./hasForcedResolvers.js";
export { isArray } from "./isArray.js";
export { isDocumentNode } from "./isDocumentNode.js";
export { isField } from "./isField.js";
export { isNonEmptyArray } from "./isNonEmptyArray.js";
export { isNonNullObject } from "./isNonNullObject.js";
export { isPlainObject } from "./isPlainObject.js";
export { makeReference } from "./makeReference.js";
export { makeUniqueId } from "./makeUniqueId.js";
export { maybeDeepFreeze } from "./maybeDeepFreeze.js";
export { mergeDeep } from "./mergeDeep.js";
export { mergeDeepArray } from "./mergeDeepArray.js";
export { mergeOptions } from "./mergeOptions.js";
export { omitDeep } from "./omitDeep.js";
export { preventUnhandledRejection } from "./preventUnhandledRejection.js";
export { removeDirectivesFromDocument } from "./removeDirectivesFromDocument.js";
export { removeMaskedFragmentSpreads } from "./removeFragmentSpreads.js";
export { resultKeyNameFromField } from "./resultKeyNameFromField.js";
export { shouldInclude } from "./shouldInclude.js";
export { storeKeyNameFromField } from "./storeKeyNameFromField.js";
export { stringifyForDisplay } from "./stringifyForDisplay.js";
export { toQueryResult } from "./toQueryResult.js";
export { filterMap } from "./filterMap.js";
export { equalByQuery } from "./equalByQuery.js";
export { canonicalStringify } from "./canonicalStringify.js";

export {
  getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals,
  registerGlobalCache,
} from "../internal/getMemoryInternals.js";

export { AutoCleanedStrongCache, AutoCleanedWeakCache } from "./caches.js";

export type { ApplyHKT } from "./types/ApplyHKT.js";
export type { ApplyHKTImplementationWithDefault } from "./types/ApplyHKTImplementationWithDefault.js";
