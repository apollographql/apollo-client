export { Observable } from "rxjs";

export type { DocumentTransformCacheKey } from "./graphql/DocumentTransform.js";
export { DocumentTransform } from "./graphql/DocumentTransform.js";

export { print } from "./graphql/print.js";

export type {
  AsStoreObject,
  Reference,
  StoreObject,
  StoreValue,
} from "./graphql/storeUtils.js";
export { isReference } from "./graphql/storeUtils.js";

export { addTypenameToDocument } from "./graphql/transform.js";

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

// internal
export type { PromiseWithState } from "./promises/decoration.js";
export {
  // internal
  createFulfilledPromise,
  // internal
  createRejectedPromise,
  // internal
  isStatefulPromise,
  // internal
  wrapPromiseWithState,
} from "./promises/decoration.js";

export type {
  // internal
  TupleToIntersection,
} from "./common/mergeDeep.js";
// internal
export { mergeDeep, mergeDeepArray } from "./common/mergeDeep.js";
export {
  // internal
  getGraphQLErrorsFromResult,
  // internal
  graphQLResultHasError,
} from "./common/errorHandling.js";
// internal
export { canUseDOM, canUseLayoutEffect } from "./common/canUse.js";
// internal
export { compact } from "./common/compact.js";
// internal
export { makeUniqueId } from "./common/makeUniqueId.js";
// internal
export { stringifyForDisplay } from "./common/stringifyForDisplay.js";
// internal
export { mergeOptions } from "./common/mergeOptions.js";
export {
  // internal
  isApolloPayloadResult,
  // internal
  isExecutionPatchIncrementalResult,
  // internal
  isExecutionPatchInitialResult,
  // internal
  isExecutionPatchResult,
  // internal
  mergeIncrementalData,
} from "./common/incrementalResult.js";

export { canonicalStringify } from "./shared/canonicalStringify.js";
// internal
export { omitDeep } from "./common/omitDeep.js";
export { stripTypename } from "./common/stripTypename.js";

// internal
export type { IsStrictlyAny } from "./types/IsStrictlyAny.js";
// internal
export type { DeepOmit } from "./types/DeepOmit.js";
// internal
export type { DeepPartial } from "./types/DeepPartial.js";
// internal
export type { Prettify } from "./types/Prettify.js";
// internal
export type { Primitive } from "./types/Primitive.js";
// internal
export type { UnionToIntersection } from "./types/UnionToIntersection.js";
// internal
export type { NoInfer } from "./types/NoInfer.js";
// internal
export type { RemoveIndexSignature } from "./types/RemoveIndexSignature.js";
// internal
export type { VariablesOption } from "./types/VariablesOption.js";

export {
  // internal
  AutoCleanedStrongCache,
  // internal
  AutoCleanedWeakCache,
  cacheSizes,
} from "./caching/index.js";
export type { CacheSizes } from "./caching/index.js";
