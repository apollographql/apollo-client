import type { FragmentSpreadNode, InlineFragmentNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { canonicalStringify } from "./canonicalStringify.js";
import { memoize } from "./memoize.js";

/** @internal */
export const isDeferredFragment = memoize(
  function isDeferredFragment(
    fragmentSelection: InlineFragmentNode | FragmentSpreadNode,
    variables: OperationVariables | undefined
  ) {
    return !!fragmentSelection.directives?.some((directive) => {
      if (directive.name.value !== "defer") {
        return false;
      }

      for (const arg of directive.arguments ?? []) {
        if (arg.name.value === "if") {
          switch (arg.value.kind) {
            case Kind.BOOLEAN:
              return arg.value.value;
            case Kind.VARIABLE:
              return !!variables?.[arg.value.name.value];
          }
        }
      }

      return true;
    });
  },
  {
    max:
      cacheSizes["isDeferredFragment"] ||
      defaultCacheSizes["isDeferredFragment"],
    makeCacheKey: ([selection, variables]) => [
      selection,
      canonicalStringify(variables),
    ],
  }
);
