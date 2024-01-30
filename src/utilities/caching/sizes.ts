import { global } from "../globals/index.js";

declare global {
  interface Window {
    [cacheSizeSymbol]?: Partial<CacheSizes>;
  }
}

/**
 * The cache sizes used by various Apollo Client caches.
 *
 * @remarks
 * All configurable caches hold memoized values. If an item is
 * cache-collected, it incurs only a small performance impact and
 * doesn't cause data loss. A smaller cache size might save you memory.
 *
 * You should choose cache sizes appropriate for storing a reasonable
 * number of values rather than every value. To prevent too much recalculation,
 * choose cache sizes that are at least large enough to hold memoized values for
 * all hooks/queries on the screen at any given time.
 */
/*
 * We assume a "base value" of 1000 here, which is already very generous.
 * In most applications, it will be very unlikely that 1000 different queries
 * are on screen at the same time.
 */
export interface CacheSizes {
  /**
   * Cache size for the [`print`](https://github.com/apollographql/apollo-client/blob/main/src/utilities/graphql/print.ts) function.
   *
   * It is called with transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This method is called to transform a GraphQL query AST parsed by `gql`
   * back into a GraphQL string.
   *
   * @privateRemarks
   * This method is called from the `QueryManager` and various `ApolloLink`s,
   * always with the "serverQuery", so the server-facing part of a transformed
   * `DocumentNode`.
   */
  print: number;
  /**
   * Cache size for the [`parser`](https://github.com/apollographql/apollo-client/blob/main/src/react/parser/index.ts) function.
   *
   * It is called with user-provided `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This method is called by HOCs and hooks.
   *
   * @privateRemarks
   * This function is used directly in HOCs, and nowadays mainly accessed by
   * calling `verifyDocumentType` from various hooks.
   * It is called with a user-provided DocumentNode.
   */
  parser: number;
  /**
   * Cache size for the cache of [`DocumentTransform`](https://github.com/apollographql/apollo-client/blob/main/src/utilities/graphql/DocumentTransform.ts)
   * instances with the `cache` option set to `true`.
   *
   * Can be called with user-defined or already-transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * The cache size here should be chosen with other `DocumentTransform`s in mind.
   * For example, if there was a `DocumentTransform` that would take `x` `DocumentNode`s,
   * and returned a differently-transformed `DocumentNode` depending if the app is
   * online or offline, then we assume that the cache returns `2*x` documents.
   * If that were concatenated with another `DocumentTransform` that would
   * also duplicate the cache size, you'd need to account for `4*x` documents
   * returned by the second transform.
   *
   * Due to an implementation detail of Apollo Client, if you use custom document
   * transforms you should always add `n` (the "base" number of user-provided
   * Documents) to the resulting cache size.
   *
   * If we assume that the user-provided transforms receive `n` documents and
   * return `n` documents, the cache size should be `2*n`.
   *
   * If we assume that the chain of user-provided transforms receive `n` documents and
   * return `4*n` documents, the cache size should be `5*n`.
   *
   * This size should also then be used in every other cache that mentions that
   * it operates on a "transformed" `DocumentNode`.
   *
   * @privateRemarks
   * Cache size for the `performWork` method of each [`DocumentTransform`](https://github.com/apollographql/apollo-client/blob/main/src/utilities/graphql/DocumentTransform.ts).
   *
   * No user-provided DocumentNode will actually be "the last one", as we run the
   * `defaultDocumentTransform` before *and* after the user-provided transforms.
   * For that reason, we need the extra `n` here - `n` for "before transformation"
   * plus the actual maximum cache size of the user-provided transform chain.
   *
   * This method is called from `transformDocument`, which is called from
   * `QueryManager` with a user-provided DocumentNode.
   * It is also called with already-transformed DocumentNodes, assuming the
   * user provided additional transforms.
   *
   */
  "documentTransform.cache": number;
  /**
   * A cache inside of [`QueryManager`](https://github.com/apollographql/apollo-client/blob/main/src/core/QueryManager.ts).
   *
   * It is called with transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @privateRemarks
   * Cache size for the `transformCache` used in the `getDocumentInfo` method of `QueryManager`.
   * Called throughout the `QueryManager` with transformed DocumentNodes.
   */
  "queryManager.getDocumentInfo": number;
  /**
   * A cache inside of [`PersistedQueryLink`](https://github.com/apollographql/apollo-client/blob/main/src/link/persisted-queries/index.ts).
   *
   * It is called with transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @remarks
   * This cache is used to cache the hashes of persisted queries.
   *
   * @privateRemarks
   * Cache size for the `hashesByQuery` cache in the `PersistedQueryLink`.
   */
  "PersistedQueryLink.persistedQueryHashes": number;
  /**
   * Cache used by [`canonicalStringify`](https://github.com/apollographql/apollo-client/blob/main/src/utilities/common/canonicalStringify.ts).
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
   *
   * @privateRemarks
   * Cache size for the `sortingMap` in `canonicalStringify`.
   */
  canonicalStringify: number;
  /**
   * A cache inside of [`FragmentRegistry`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/fragmentRegistry.ts).
   *
   * Can be called with user-defined or already-transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @privateRemarks
   *
   * Cache size for the `transform` method of FragmentRegistry.
   * This function is called as part of the `defaultDocumentTransform` which will be called with
   * user-provided and already-transformed DocumentNodes.
   *
   */
  "fragmentRegistry.transform": number;
  /**
   * A cache inside of [`FragmentRegistry`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/fragmentRegistry.ts).
   *
   * This function is called with fragment names in the form of a string.
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * The size of this case should be chosen with the number of fragments in
   * your application in mind.
   *
   * Note:
   * This function is a dependency of `fragmentRegistry.transform`, so having too small of a cache size here
   * might involuntarily invalidate values in the `transform` cache.
   *
   * @privateRemarks
   * Cache size for the `lookup` method of FragmentRegistry.
   */
  "fragmentRegistry.lookup": number;
  /**
   * Cache size for the `findFragmentSpreads` method of [`FragmentRegistry`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/fragmentRegistry.ts).
   *
   * This function is called with transformed `DocumentNode`s, as well as recursively
   * with every fragment spread referenced within that, or a fragment referenced by a
   * fragment spread.
   *
   * @defaultValue
   * Defaults to `4000`.
   *
   * @remarks
   *
   * Note: This function is a dependency of `fragmentRegistry.transform`, so having too small of cache size here
   * might involuntarily invalidate values in the `transform` cache.
   */
  "fragmentRegistry.findFragmentSpreads": number;
  /**
   * Cache size for the `getFragmentDoc` method of [`ApolloCache`](https://github.com/apollographql/apollo-client/blob/main/src/cache/core/cache.ts).
   *
   * This function is called with user-provided fragment definitions.
   *
   * @defaultValue
   * Defaults to `1000`.
   *
   * @remarks
   * This function is called from `readFragment` with user-provided fragment definitions.
   */
  "cache.fragmentQueryDocuments": number;
  /**
   * Cache used in [`removeTypenameFromVariables`](https://github.com/apollographql/apollo-client/blob/main/src/link/remove-typename/removeTypenameFromVariables.ts).
   *
   * This function is called transformed `DocumentNode`s.
   *
   * @defaultValue
   * Defaults to `2000`.
   *
   * @privateRemarks
   * Cache size for the `getVariableDefinitions` function of `removeTypenameFromVariables`.
   */
  "removeTypenameFromVariables.getVariableDefinitions": number;
  /**
   * Cache size for the `maybeBroadcastWatch` method on [`InMemoryCache`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/inMemoryCache.ts).
   *
   * Note: `maybeBroadcastWatch` will be set to the `resultCacheMaxSize` option and
   * will fall back to this configuration value if the option is not set.
   *
   * @defaultValue
   * Defaults to `5000`.
   *
   * @remarks
   * This method is used for dependency tracking in the `InMemoryCache` and
   * prevents from unnecessary re-renders.
   * It is recommended to keep this value significantly higher than the number of
   * possible subscribers you will have active at the same time in your application
   * at any time.
   */
  "inMemoryCache.maybeBroadcastWatch": number;
  /**
   * Cache size for the `executeSelectionSet` method on [`StoreReader`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/readFromStore.ts).
   *
   * Note:
   * `executeSelectionSet` will be set to the `resultCacheMaxSize` option and
   * will fall back to this configuration value if the option is not set.
   *
   * @defaultValue
   * Defaults to `10000`.
   *
   * @remarks
   * Every object that is read from the cache will be cached here, so it is
   * recommended to set this to a high value.
   */
  "inMemoryCache.executeSelectionSet": number;
  /**
   * Cache size for the `executeSubSelectedArray` method on [`StoreReader`](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/readFromStore.ts).
   *
   * Note:
   * `executeSubSelectedArray` will be set to the `resultCacheMaxSize` option and
   * will fall back to this configuration value if the option is not set.
   *
   * @defaultValue
   * Defaults to `5000`.
   *
   * @remarks
   * Every array that is read from the cache will be cached here, so it is
   * recommended to set this to a high value.
   */
  "inMemoryCache.executeSubSelectedArray": number;
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
 *   parser: 100
 * } satisfies Partial<CacheSizes> // the `satisfies` is optional if using TypeScript
 * ```
 */
export const cacheSizes: Partial<CacheSizes> = { ...global[cacheSizeSymbol] };

export const enum defaultCacheSizes {
  parser = 1000,
  canonicalStringify = 1000,
  print = 2000,
  "documentTransform.cache" = 2000,
  "queryManager.getDocumentInfo" = 2000,
  "PersistedQueryLink.persistedQueryHashes" = 2000,
  "fragmentRegistry.transform" = 2000,
  "fragmentRegistry.lookup" = 1000,
  "fragmentRegistry.findFragmentSpreads" = 4000,
  "cache.fragmentQueryDocuments" = 1000,
  "removeTypenameFromVariables.getVariableDefinitions" = 2000,
  "inMemoryCache.maybeBroadcastWatch" = 5000,
  "inMemoryCache.executeSelectionSet" = 50000,
  "inMemoryCache.executeSubSelectedArray" = 10000,
}
