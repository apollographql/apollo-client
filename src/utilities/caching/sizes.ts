import { global } from "../globals/index.js";

declare global {
  interface Window {
    [cacheSizeSymbol]?: Partial<CacheSizes>;
  }
}

/**
 * The cache sizes used by various Apollo Client caches.
 *
 * Note that these caches are all derivative and if an item is cache-collected,
 * it's not the end of the world - the cached item will just be recalculated.
 *
 * As a result, these cache sizes should not be chosen to hold every value ever
 * encountered, but rather to hold a reasonable number of values that can be
 * assumed to be on the screen at any given time.
 *
 * We assume a "base value" of 1000 here, which is already very generous.
 * In most applications, it will be very unlikely that 1000 different queries
 * are on screen at the same time.
 */
interface CacheSizes {
  /**
   * Cache size for the [`print`](../../utilities/graphql/print.ts) function.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This method is called from the `QueryManager` and various `Link`s,
   * always with the "serverQuery", so the server-facing part of a transformed
   * DocumentNode.
   */
  print: number;
  /**
   * Cache size for the [`parser`](../../react/parser/index.ts) function.
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This function is used directly in HOCs, and nowadays mainly accessed by
   * calling `verifyDocumentType` from various hooks.
   * It is called with a user-provided DocumentNode.
   */
  parser: number;
  /**
   * Cache size for the `performWork` method of each [`DocumentTransform`](../../utilities/graphql/DocumentTransform.ts).
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This method is called from `transformDocument`, which is called from
   * `QueryManager` with a user-provided DocumentNode.
   * It is also called with already-transformed DocumentNodes, assuming the
   * user provided additional transforms.
   *
   * The cache size here should be chosen with other DocumentTransforms in mind.
   * For example, if there was a DocumentTransform that would take `n` DocumentNodes,
   * and returned a differently-transformed DocumentNode depending if the app is
   * online or offline, then we assume that the cache returns `2*n` documents.
   *
   * No user-provided DocumentNode will actually be "the last one", as we run the
   * `defaultDocumentTransform` before *and* after the user-provided transforms.
   *
   * So if we assume that the user-provided transforms receive `n` documents and
   * return `n` documents, the cache size should be `2*n`.
   *
   * If we assume that the user-provided transforms receive `n` documents and
   * returns `2*n` documents, the cache size should be `3*n`.
   *
   * This size should also then be used in every other cache that mentions that
   * it operates on a "transformed" DocumentNode.
   */
  documentTransform: number;
  /**
   * Cache size for the `transformCache` used in the `getDocumentInfo` method of
   * [`QueryManager`](../../core/QueryManager.ts).
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * `getDocumentInfo` is called throughout the `QueryManager` with transformed
   * DocumentNodes.
   */
  queryManagerTransforms: number;
  /**
   * Cache size for the `hashesByQuery` cache in the [`PersistedQueryLink`](../../link/persisted-queries/index.ts).
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This cache is used to cache the hashes of persisted queries. It is working with
   * transformed DocumentNodes.
   */
  persistedQueryHashes: number;
  /**
   * Cache for the `sortingMap` used by [`canonicalStringify`](../../utilities/common/canonicalStringify.ts).
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This cache contains the sorted keys of objects that are stringified by
   * `canonicalStringify`.
   * It uses the stringified unsorted keys of objects as keys.
   * The cache will not grow beyond the size of different object **shapes**
   * encountered in an application, no matter how much actual data gets stringified.
   */
  canonicalStringify: number;
  /**
   * Cache size for the `transform` method of [`FragmentRegistry`](../../cache/inmemory/fragmentRegistry.ts).
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This function is called as part of the `defaultDocumentTransform` which will be called with
   * user-provided and already-transformed DocumentNodes.
   *
   */
  fragmentRegistryTransform: number;
  /**
   * Cache size for the `lookup` method of [`FragmentRegistry`](../../cache/inmemory/fragmentRegistry.ts).
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This function is called with fragment names in the form of a string.
   *
   * Note:
   * This function is a dependency of `transform`, so having a too small cache size here
   * might involuntarily invalidate values in the `transform` cache.
   */
  fragmentRegistryLookup: number;
  /**
   * Cache size for the `findFragmentSpreads` method of [`FragmentRegistry`](../../cache/inmemory/fragmentRegistry.ts).
   *
   * @defaultValue
   * Defaults to `4000`.
   *
   * @remarks
   * This function is called with transformed DocumentNodes, as well as recursively
   * with every fragment spread referenced within that, or a fragment referenced by a
   * fragment spread.
   *
   * Note:
   * This function is a dependency of `transform`, so having a too small cache size here
   * might involuntarily invalidate values in the `transform` cache.
   */
  fragmentRegistryFindFragmentSpreads: number;
  /**
   * Cache size for the `getFragmentDoc` method of [`ApolloCache`](../../cache/core/cache.ts).
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This function is called from `readFragment` with user-provided fragment definitions.
   */
  fragmentQueryDocuments: number;
  /**
   * Cache size for the `getVariableDefinitions` function in [`removeTypenameFromVariables`](../../link/remove-typename/removeTypenameFromVariables.ts).
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This function is called in a link with transformed DocumentNodes.
   */
  getVariableDefinitions: number;
}

const cacheSizeSymbol = Symbol.for("apollo.cacheSize");
/**
 *
 * The global cache size configuration for Apollo Client.
 *
 * @remarks
 *
 * You can directly modify this object, but any modification will
 * only have an effect on caches that are created after the modification.
 *
 * So for global caches, such as `parser`, `canonicalStringify` and `print`,
 * you might need to call `.reset` on them, which will essentially re-create them.
 *
 * Alternatively, you can set `globalThis[Symbol.for("apollo.cacheSize")]` before
 * you load the Apollo Client package:
 *
 * @example
 * ```ts
 * globalThis[Symbol.for("apollo.cacheSize")] = {
 *  parser: 100
 * }
 * ```
 */
export const cacheSizes: CacheSizes = {
  parser: 1000,
  canonicalStringify: 1000,
  print: 2000,
  documentTransform: 2000,
  queryManagerTransforms: 2000,
  persistedQueryHashes: 2000,
  fragmentRegistryTransform: 2000,
  fragmentRegistryLookup: 1000,
  fragmentRegistryFindFragmentSpreads: 4000,
  fragmentQueryDocuments: 1000,
  getVariableDefinitions: 2000,
  ...global[cacheSizeSymbol],
};
