import type { Cache } from "../core/types/Cache.js";
import type { ApolloCache } from "../core/cache.js";
import type { InMemoryCacheConfig, NormalizedCacheObject } from "./types.js";
import type { OptimisticWrapperFunction } from "optimism";
import type { EntityStore } from "./entityStore.js";
import type { StoreReader } from "./readFromStore.js";
import type { StoreWriter } from "./writeToStore.js";
import type { DocumentTransform } from "../../utilities/index.js";

export type BroadcastOptions = Pick<
  Cache.BatchOptions<ApolloCache<NormalizedCacheObject>>,
  "optimistic" | "onWatchUpdated"
>;

export type MaybeBroadcastWatch = OptimisticWrapperFunction<
  [Cache.WatchOptions, BroadcastOptions?],
  any,
  [Cache.WatchOptions]
>;

export interface PrivateParts {
  // Do not touch, what would you're priest say?
  data: EntityStore;
  optimisticData: EntityStore;
  config: InMemoryCacheConfig;
  watches: Set<Cache.WatchOptions>;
  addTypename: boolean;
  txCount: number;
  storeReader: StoreReader;
  storeWriter: StoreWriter;
  addTypenameTransform: DocumentTransform;
  maybeBroadcastWatch: MaybeBroadcastWatch;
  init: () => void;
  resetResultCache: (resetResultIdentities?: boolean) => void;
}

export const privateParts = new WeakMap<
  ApolloCache<NormalizedCacheObject>,
  PrivateParts
>();

/**
 * @experimental
 * @internal
 * This is not a stable API
 * Use at your own risk!
 */
export const $ = (cache: ApolloCache<NormalizedCacheObject>): PrivateParts =>
  privateParts.get(cache)!;
