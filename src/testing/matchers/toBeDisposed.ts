import type { MatcherFunction } from "expect";
import type { QueryReference } from "../../react/cache/QueryReference.js";
import {
  InternalQueryReference,
  unwrapQueryRef,
} from "../../react/cache/QueryReference.js";

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

  // This is a bit of a hacky check but we know the subscription is removed
  // on dispose, so we can check to see if its set or not
  const pass = unwrapQueryRef(queryRef)["subscription"] === null;

  return {
    pass,
    message: () => {
      return `${hint}\n\nExpected queryRef ${
        this.isNot ? "not " : ""
      }to be disposed, but it was${this.isNot ? "" : " not"}.`;
    },
  };
};
