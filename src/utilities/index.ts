export { Observable } from "rxjs";

export type { DeepPartial } from "./DeepPartial.js";

export type { DocumentTransformCacheKey } from "./graphql/DocumentTransform.js";
export { DocumentTransform } from "./graphql/DocumentTransform.js";

export { print } from "./graphql/print.js";
export { isFormattedExecutionResult } from "./graphql/isFormattedExecutionResult.js";

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
  canonicalStringify,
  getMainDefinition,
} from "@apollo/client/utilities/internal";

export {
  concatPagination,
  offsetLimitPagination,
  relayStylePagination,
} from "./policies/pagination.js";

export { stripTypename } from "./common/stripTypename.js";

export { cacheSizes } from "./caching/index.js";
export type { CacheSizes } from "./caching/index.js";

export type { HKT } from "./HKT.js";

export { isNetworkRequestInFlight } from "./isNetworkRequestInFlight.js";
export { isNetworkRequestSettled } from "./isNetworkRequestSettled.js";
