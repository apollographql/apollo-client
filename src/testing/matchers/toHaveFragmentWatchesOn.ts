import { iterableEquality } from "@jest/expect-utils";
import type { Trie } from "@wry/trie";
import type { MatcherFunction } from "expect";

import type {
  ApolloClient,
  Cache,
  DocumentNode,
  InMemoryCache,
} from "@apollo/client";

export type KeyOptions = Pick<
  Cache.WatchOptions,
  "id" | "optimistic" | "variables"
>;

export const toHaveFragmentWatchesOn: MatcherFunction<
  [fragment: DocumentNode, keyOptions: Array<KeyOptions>]
> = function (_client, fragment, keyOptions) {
  const hint = this.utils.matcherHint(
    "toHaveFragmentWatches",
    "client",
    "keyOptions",
    {
      isNot: this.isNot,
    }
  );
  const client = _client as ApolloClient;
  const cache = client.cache as InMemoryCache;

  function getFragmentWatches() {
    // testing implementation detail to ensure cache.fragmentWatches also cleans up
    const watchedItems: Trie<any> | undefined = cache["fragmentWatches"][
      "weak"
    ].get(
      client.cache["getFragmentDoc"](
        client["transform"](fragment, true),
        undefined
      )
    );
    function* iterateStrongTrieChildren(
      trie: Trie<any> | undefined,
      path: any[]
    ): Generator<any[]> {
      if (!trie) return;
      if (trie["data"]) {
        yield path;
      }
      if (trie["strong"]) {
        for (const [key, value] of Array.from(
          (trie["strong"] as Map<any, Trie<any> | undefined>)?.entries()
        )) {
          yield* iterateStrongTrieChildren(value, path.concat(key));
        }
      }
    }

    return Array.from(iterateStrongTrieChildren(watchedItems, []));
  }

  const watches = getFragmentWatches().map((cacheKey) => {
    if (cacheKey.length > 1) {
      throw new Error(
        "The `watchFragment` watcher cache key has changed. Please update the toHaveFragmentWatchesOn matcher."
      );
    }

    return JSON.parse(cacheKey[0]);
  });

  const pass = this.equals(watches, keyOptions, [
    ...this.customTesters,
    iterableEquality,
  ]);

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          hint +
          "\n\nExpected client not to have fragment watches equal to expected but it did."
        );
      }

      return (
        hint +
        "\n\n" +
        this.utils.printDiffOrStringify(
          keyOptions,
          watches,
          "Expected",
          "Received",
          true
        )
      );
    },
  };
};
