import { NormalizedCache, NormalizedCacheObject } from "../types";
import { EntityStore } from "../entityStore";
import { InMemoryCache } from "../inMemoryCache";
import { StoreWriter, WriteToStoreOptions } from "../writeToStore";

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  const cache = new InMemoryCache();
  return new EntityStore.Root({
    policies: cache.policies,
    resultCaching: true,
    seed,
  });
}

interface WriteQueryToStoreOptions
extends Omit<WriteToStoreOptions, "store"> {
  writer: StoreWriter;
  store?: NormalizedCache;
}

export function writeQueryToStore(
  options: WriteQueryToStoreOptions,
): NormalizedCache {
  const {
    dataId = "ROOT_QUERY",
    store = new EntityStore.Root({
      policies: options.writer.cache.policies,
    }),
  } = options;
  options.writer.writeToStore({ ...options, dataId, store });
  return store;
}

describe("defaultNormalizedCacheFactory", function () {
  it("should return an EntityStore", function () {
    const store = defaultNormalizedCacheFactory();
    expect(store).toBeInstanceOf(EntityStore);
    expect(store).toBeInstanceOf(EntityStore.Root);
  });
});
