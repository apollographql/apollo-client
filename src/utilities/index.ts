export { DEV, maybe } from "./globals/index.js";

export type {
  DirectiveInfo,
  InclusionDirectives,
} from "./graphql/directives.js";
export {
  shouldInclude,
  hasDirectives,
  hasAnyDirectives,
  hasAllDirectives,
  hasClientExports,
  getDirectiveNames,
  getInclusionDirectives,
} from "./graphql/directives.js";

export type { DocumentTransformCacheKey } from "./graphql/DocumentTransform.js";
export { DocumentTransform } from "./graphql/DocumentTransform.js";

export type { FragmentMap, FragmentMapFunction } from "./graphql/fragments.js";
export {
  createFragmentMap,
  getFragmentQueryDocument,
  getFragmentFromSelection,
} from "./graphql/fragments.js";

export {
  checkDocument,
  getOperationDefinition,
  getOperationName,
  getFragmentDefinitions,
  getQueryDefinition,
  getFragmentDefinition,
  getMainDefinition,
  getDefaultValues,
} from "./graphql/getFromAST.js";

export { print } from "./graphql/print.js";

export type {
  StoreObject,
  AsStoreObject,
  Reference,
  StoreValue,
  Directives,
  VariableValue,
} from "./graphql/storeUtils.js";
export {
  makeReference,
  isDocumentNode,
  isReference,
  isField,
  isInlineFragment,
  valueToObjectRepresentation,
  storeKeyNameFromField,
  argumentsObjectFromField,
  resultKeyNameFromField,
  getStoreKeyName,
  getTypenameFromResult,
} from "./graphql/storeUtils.js";

export type {
  RemoveNodeConfig,
  GetNodeConfig,
  RemoveDirectiveConfig,
  GetDirectiveConfig,
  RemoveArgumentsConfig,
  GetFragmentSpreadConfig,
  RemoveFragmentSpreadConfig,
  RemoveFragmentDefinitionConfig,
  RemoveVariableDefinitionConfig,
} from "./graphql/transform.js";
export {
  addTypenameToDocument,
  buildQueryFromSelectionSet,
  removeDirectivesFromDocument,
  removeConnectionDirectiveFromDocument,
  removeArgumentsFromDocument,
  removeFragmentSpreadFromDocument,
  removeClientSetsFromDocument,
} from "./graphql/transform.js";

export {
  isMutationOperation,
  isQueryOperation,
  isSubscriptionOperation,
} from "./graphql/operations.js";

export {
  concatPagination,
  offsetLimitPagination,
  relayStylePagination,
} from "./policies/pagination.js";

export type {
  Observer,
  ObservableSubscription,
} from "./observables/Observable.js";
export { Observable } from "./observables/Observable.js";

export type { PromiseWithState } from "./promises/decoration.js";
export {
  isStatefulPromise,
  createFulfilledPromise,
  createRejectedPromise,
  wrapPromiseWithState,
} from "./promises/decoration.js";

export * from "./common/mergeDeep.js";
export * from "./common/cloneDeep.js";
export * from "./common/maybeDeepFreeze.js";
export * from "./observables/iteration.js";
export * from "./observables/asyncMap.js";
export * from "./observables/Concast.js";
export * from "./observables/subclassing.js";
export * from "./common/arrays.js";
export * from "./common/objects.js";
export * from "./common/errorHandling.js";
export * from "./common/canUse.js";
export * from "./common/compact.js";
export * from "./common/makeUniqueId.js";
export * from "./common/stringifyForDisplay.js";
export * from "./common/mergeOptions.js";
export * from "./common/incrementalResult.js";

export { canonicalStringify } from "./common/canonicalStringify.js";
export { omitDeep } from "./common/omitDeep.js";
export { stripTypename } from "./common/stripTypename.js";

export * from "./types/IsStrictlyAny.js";
export type { DeepOmit } from "./types/DeepOmit.js";
export type { DeepPartial } from "./types/DeepPartial.js";
export type { OnlyRequiredProperties } from "./types/OnlyRequiredProperties.js";

export {
  AutoCleanedStrongCache,
  AutoCleanedWeakCache,
  cacheSizes,
  defaultCacheSizes,
} from "./caching/index.js";
export type { CacheSizes } from "./caching/index.js";
