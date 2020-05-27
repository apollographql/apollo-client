import { NormalizedCache, NormalizedCacheObject } from "../types";
import { EntityStore } from "../entityStore";
import { InMemoryCache } from "../inMemoryCache";

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

describe("defaultNormalizedCacheFactory", function () {
  it("should return an EntityStore", function () {
    const store = defaultNormalizedCacheFactory();
    expect(store).toBeInstanceOf(EntityStore);
    expect(store).toBeInstanceOf(EntityStore.Root);
  });
});
