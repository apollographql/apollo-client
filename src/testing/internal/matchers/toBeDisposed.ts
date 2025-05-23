import type { MatcherFunction } from "expect";

import type { QueryRef } from "@apollo/client/react/internal";
import {
  assertWrappedQueryRef,
  unwrapQueryRef,
} from "@apollo/client/react/internal";

export const toBeDisposed: MatcherFunction<[]> = function (_queryRef) {
  const hint = this.utils.matcherHint("toBeDisposed", "queryRef", "", {
    isNot: this.isNot,
  });

  const queryRef = _queryRef as QueryRef;
  assertWrappedQueryRef(queryRef);

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
