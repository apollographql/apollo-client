import type { MatcherFunction } from "expect";

import type { InMemoryCache } from "@apollo/client";

export const toHaveNumWatches: MatcherFunction<[size: number]> = function (
  _cache,
  size
) {
  const hint = this.utils.matcherHint("toHaveNumWatches", "cache", "size", {
    isNot: this.isNot,
  });
  const cache = _cache as InMemoryCache;
  const watchSize = cache["watches"].size;
  const watchIds = Array.from(cache["watches"].values()).map(
    (watch) => `'${watch.id ?? "ROOT_QUERY"}'`
  );
  const pass = watchSize === size;

  const plural = (size: number) => (size === 1 ? "watch" : "watches");

  return {
    pass,
    message: () => {
      return `${hint}\n\nExpected cache ${
        this.isNot ? "not " : ""
      }to have ${this.utils.printExpected(size)} ${plural(
        size
      )} but instead it had ${this.utils.printReceived(watchSize)} ${plural(
        watchSize
      )}.\n\nWatches: ${this.utils.printReceived(
        "[" + watchIds.join(", ") + "]"
      )}`;
    },
  };
};
