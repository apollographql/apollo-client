export { Observable } from "rxjs";

export { maybe } from "./globals/index.js";

export type {
  DirectiveInfo,
  InclusionDirectives,
} from "./graphql/directives.js";
export {
  getDirectiveNames,
  getFragmentMaskMode,
  getInclusionDirectives,
  hasAllDirectives,
  hasAnyDirectives,
  hasClientExports,
  hasDirectives,
  shouldInclude,
} from "./graphql/directives.js";

export type { DocumentTransformCacheKey } from "./graphql/DocumentTransform.js";
export { DocumentTransform } from "./graphql/DocumentTransform.js";

export type { FragmentMap, FragmentMapFunction } from "./graphql/fragments.js";
export {
  createFragmentMap,
  getFragmentFromSelection,
  getFragmentQueryDocument,
  isFullyUnmaskedOperation,
} from "./graphql/fragments.js";

export {
  checkDocument,
  getDefaultValues,
  getFragmentDefinition,
  getFragmentDefinitions,
  getMainDefinition,
  getOperationDefinition,
  getOperationName,
  getQueryDefinition,
} from "./graphql/getFromAST.js";

export { print } from "./graphql/print.js";

export type {
  AsStoreObject,
  Directives,
  Reference,
  StoreObject,
  StoreValue,
  VariableValue,
} from "./graphql/storeUtils.js";
export {
  argumentsObjectFromField,
  getStoreKeyName,
  getTypenameFromResult,
  isDocumentNode,
  isField,
  isInlineFragment,
  isReference,
  makeReference,
  resultKeyNameFromField,
  storeKeyNameFromField,
  valueToObjectRepresentation,
} from "./graphql/storeUtils.js";

export type {
  GetDirectiveConfig,
  GetFragmentSpreadConfig,
  GetNodeConfig,
  RemoveArgumentsConfig,
  RemoveDirectiveConfig,
  RemoveFragmentDefinitionConfig,
  RemoveFragmentSpreadConfig,
  RemoveNodeConfig,
  RemoveVariableDefinitionConfig,
} from "./graphql/transform.js";
export {
  addNonReactiveToNamedFragments,
  addTypenameToDocument,
  buildQueryFromSelectionSet,
  removeArgumentsFromDocument,
  removeClientSetsFromDocument,
  removeConnectionDirectiveFromDocument,
  removeDirectivesFromDocument,
  removeFragmentSpreadFromDocument,
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

export type { PromiseWithState } from "./promises/decoration.js";
export {
  createFulfilledPromise,
  createRejectedPromise,
  isStatefulPromise,
  wrapPromiseWithState,
} from "./promises/decoration.js";

export { preventUnhandledRejection } from "./promises/preventUnhandledRejection.js";

export * from "./common/mergeDeep.js";
export * from "./common/cloneDeep.js";
export { maybeDeepFreeze } from "./common/maybeDeepFreeze.js";
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

export type * from "./types/IsStrictlyAny.js";
export type { DeepOmit } from "./types/DeepOmit.js";
export type { DeepPartial } from "./types/DeepPartial.js";
export type { OnlyRequiredProperties } from "./types/OnlyRequiredProperties.js";
export type { Prettify } from "./types/Prettify.js";
export type { Primitive } from "./types/Primitive.js";
export type { UnionToIntersection } from "./types/UnionToIntersection.js";
export type { NoInfer } from "./types/NoInfer.js";
export type { RemoveIndexSignature } from "./types/RemoveIndexSignature.js";

export {
  AutoCleanedStrongCache,
  AutoCleanedWeakCache,
  cacheSizes,
  defaultCacheSizes,
} from "./caching/index.js";
export type { CacheSizes } from "./caching/index.js";
