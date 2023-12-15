import type { OptimisticWrapperFunction } from "optimism";
import type {
  InMemoryCache,
  DocumentTransform,
  ApolloLink,
  ApolloCache,
} from "../../core/index.js";
import type { ApolloClient } from "../../core/index.js";
import type { CacheSizes } from "./sizes.js";
import { cacheSizes, defaultCacheSizes } from "./sizes.js";

const globalCaches: {
  print?: () => number;
  parser?: () => number;
  canonicalStringify?: () => number;
} = {};

export function registerGlobalCache(
  name: keyof typeof globalCaches,
  getSize: () => number
) {
  globalCaches[name] = getSize;
}

/**
 * Transformative helper type to turn a function of the form
 * ```ts
 * (this: any) => R
 * ```
 * into a function of the form
 * ```ts
 * () => R
 * ```
 * preserving the return type, but removing the `this` parameter.
 *
 * @remarks
 *
 * Further down in the definitions of `_getApolloClientMemoryInternals`,
 * `_getApolloCacheMemoryInternals` and `_getInMemoryCacheMemoryInternals`,
 * having the `this` parameter annotation is extremely useful for type checking
 * inside the function.
 *
 * If this is preserved in the exported types, though, it leads to a situation
 * where `ApolloCache.getMemoryInternals` is a function that requires a `this`
 * of the type `ApolloCache`, while the extending class `InMemoryCache` has a
 * `getMemoryInternals` function that requires a `this` of the type
 * `InMemoryCache`.
 * This is not compatible with TypeScript's inheritence system (although it is
 * perfectly correct), and so TypeScript will complain loudly.
 *
 * We still want to define our functions with the `this` annotation, though,
 * and have the return type inferred.
 * (This requirement for return type inference here makes it impossible to use
 * a function overload that is more explicit on the inner overload than it is
 * on the external overload.)
 *
 * So in the end, we use this helper to remove the `this` annotation from the
 * exported function types, while keeping it in the internal implementation.
 *
 */
type RemoveThis<T> = T extends (this: any) => infer R ? () => R : never;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getApolloClientMemoryInternals =
  __DEV__ ?
    (_getApolloClientMemoryInternals as RemoveThis<
      typeof _getApolloClientMemoryInternals
    >)
  : undefined;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getInMemoryCacheMemoryInternals =
  __DEV__ ?
    (_getInMemoryCacheMemoryInternals as RemoveThis<
      typeof _getInMemoryCacheMemoryInternals
    >)
  : undefined;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getApolloCacheMemoryInternals =
  __DEV__ ?
    (_getApolloCacheMemoryInternals as RemoveThis<
      typeof _getApolloCacheMemoryInternals
    >)
  : undefined;

function getCurrentCacheSizes() {
  // `defaultCacheSizes` is a `const enum` that will be inlined during build, so we have to reconstruct it's shape here
  const defaults: Record<keyof CacheSizes, number> = {
    parser: defaultCacheSizes["parser"],
    canonicalStringify: defaultCacheSizes["canonicalStringify"],
    print: defaultCacheSizes["print"],
    "documentTransform.cache": defaultCacheSizes["documentTransform.cache"],
    "queryManager.getDocumentInfo":
      defaultCacheSizes["queryManager.getDocumentInfo"],
    "PersistedQueryLink.persistedQueryHashes":
      defaultCacheSizes["PersistedQueryLink.persistedQueryHashes"],
    "fragmentRegistry.transform":
      defaultCacheSizes["fragmentRegistry.transform"],
    "fragmentRegistry.lookup": defaultCacheSizes["fragmentRegistry.lookup"],
    "fragmentRegistry.findFragmentSpreads":
      defaultCacheSizes["fragmentRegistry.findFragmentSpreads"],
    "cache.fragmentQueryDocuments":
      defaultCacheSizes["cache.fragmentQueryDocuments"],
    "removeTypenameFromVariables.getVariableDefinitions":
      defaultCacheSizes["removeTypenameFromVariables.getVariableDefinitions"],
    "inMemoryCache.maybeBroadcastWatch":
      defaultCacheSizes["inMemoryCache.maybeBroadcastWatch"],
    "inMemoryCache.executeSelectionSet":
      defaultCacheSizes["inMemoryCache.executeSelectionSet"],
    "inMemoryCache.executeSubSelectedArray":
      defaultCacheSizes["inMemoryCache.executeSubSelectedArray"],
  };
  return Object.fromEntries(
    Object.entries(defaults).map(([k, v]) => [
      k,
      cacheSizes[k as keyof CacheSizes] || v,
    ])
  );
}

function _getApolloClientMemoryInternals(this: ApolloClient<any>) {
  if (!__DEV__) throw new Error("only supported in development mode");

  return {
    limits: getCurrentCacheSizes(),
    sizes: {
      print: globalCaches.print?.(),
      parser: globalCaches.parser?.(),
      canonicalStringify: globalCaches.canonicalStringify?.(),
      links: linkInfo(this.link),
      queryManager: {
        getDocumentInfo: this["queryManager"]["transformCache"].size,
        documentTransforms: transformInfo(
          this["queryManager"].documentTransform
        ),
      },
      ...(this.cache.getMemoryInternals?.() as Partial<
        ReturnType<typeof _getApolloCacheMemoryInternals>
      > &
        Partial<ReturnType<typeof _getInMemoryCacheMemoryInternals>>),
    },
  };
}

function _getApolloCacheMemoryInternals(this: ApolloCache<any>) {
  return {
    cache: {
      fragmentQueryDocuments: getWrapperInformation(this["getFragmentDoc"]),
    },
  };
}

function _getInMemoryCacheMemoryInternals(this: InMemoryCache) {
  const fragments = this.config.fragments as
    | undefined
    | {
        findFragmentSpreads?: Function;
        transform?: Function;
        lookup?: Function;
      };

  return {
    ..._getApolloCacheMemoryInternals.apply(this as any),
    addTypenameDocumentTransform: transformInfo(this["addTypenameTransform"]),
    inMemoryCache: {
      executeSelectionSet: getWrapperInformation(
        this["storeReader"]["executeSelectionSet"]
      ),
      executeSubSelectedArray: getWrapperInformation(
        this["storeReader"]["executeSubSelectedArray"]
      ),
      maybeBroadcastWatch: getWrapperInformation(this["maybeBroadcastWatch"]),
    },
    fragmentRegistry: {
      findFragmentSpreads: getWrapperInformation(
        fragments?.findFragmentSpreads
      ),
      lookup: getWrapperInformation(fragments?.lookup),
      transform: getWrapperInformation(fragments?.transform),
    },
  };
}

function isWrapper(f?: Function): f is OptimisticWrapperFunction<any, any> {
  return !!f && "dirtyKey" in f;
}

function getWrapperInformation(f?: Function) {
  return isWrapper(f) ? f.size : undefined;
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value != null;
}

function transformInfo(transform?: DocumentTransform) {
  return recurseTransformInfo(transform).map((cache) => ({ cache }));
}

function recurseTransformInfo(transform?: DocumentTransform): number[] {
  return transform ?
      [
        getWrapperInformation(transform?.["performWork"]),
        ...recurseTransformInfo(transform?.["left"]),
        ...recurseTransformInfo(transform?.["right"]),
      ].filter(isDefined)
    : [];
}

function linkInfo(link?: ApolloLink): unknown[] {
  return link ?
      [
        link?.getMemoryInternals?.(),
        ...linkInfo(link?.left),
        ...linkInfo(link?.right),
      ].filter(isDefined)
    : [];
}
