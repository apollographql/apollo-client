import type { MatcherFunction } from "expect";
import type { QueryReference } from "../../react/internal/index.js";
import {
  InternalQueryReference,
  unwrapQueryRef,
} from "../../react/internal/index.js";

function isQueryRef(queryRef: unknown): queryRef is QueryReference {
  try {
    return unwrapQueryRef(queryRef as any) instanceof InternalQueryReference;
  } catch (e) {
    return false;
  }
}

export const toBeDisposed: MatcherFunction<[]> = function (queryRef) {
  const hint = this.utils.matcherHint("toBeDisposed", "queryRef", "", {
    isNot: this.isNot,
  });

  if (!isQueryRef(queryRef)) {
    throw new Error(`\n${hint}\n\nmust be called with a valid QueryReference`);
  }

  const pass = unwrapQueryRef(queryRef).disposed;

  return {
    pass,
    message: () => {
      return `${hint}\n\nExpected queryRef ${
        this.isNot ? "not " : ""
      }to be disposed, but it was${this.isNot ? "" : " not"}.`;
    },
  };
};
