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
  const pass = watchSize === size;

  return {
    pass,
    message: () => {
      return `${hint}\n\nExpected cache ${
        this.isNot ? "not " : ""
      }to have ${size} ${
        size === 1 ? "watch" : "watches"
      } but instead it had ${watchSize} watches.`;
    },
  };
};
