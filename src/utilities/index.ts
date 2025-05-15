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

export { canonicalStringify } from "./shared/canonicalStringify.js";
export { stripTypename } from "./common/stripTypename.js";

export { cacheSizes } from "./caching/index.js";
export type { CacheSizes } from "./caching/index.js";

// THESE SHOULD BE REMOVED BEFORE 4.0 PUBLIC RELEASE.
// These exports are strictly for compatibility with our streaming integration.
export {
  /**
   * @deprecated Use `hasDirectives` from `@apollo/client/utilities/internal` instead.
   * */
  hasDirectives,
  /**
   * @deprecated Use `mergeIncrementalData` from `@apollo/client/utilities/internal` instead.
   * */
  mergeIncrementalData,
  /**
   * @deprecated Use `removeDirectivesFromDocument` from `@apollo/client/utilities/internal` instead.
   * */
  removeDirectivesFromDocument,
} from "@apollo/client/utilities/internal";
