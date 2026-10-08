import type { FragmentSpreadNode, InlineFragmentNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { memoize } from "./memoize.js";

const memoized = memoize(
  function (
    fragmentSelection: InlineFragmentNode | FragmentSpreadNode
  ): boolean | ((variables: OperationVariables | undefined) => boolean) {
    const directive = fragmentSelection.directives?.find(
      (directive) => directive.name.value === "defer"
    );
    if (!directive) return false;

    for (const arg of directive.arguments ?? []) {
      if (arg.name.value === "if") {
        switch (arg.value.kind) {
          case Kind.BOOLEAN:
            return arg.value.value;
          case Kind.VARIABLE:
            const varName = arg.value.name.value;
            return (variables) => !!variables?.[varName];
        }
      }
    }

    return true;
  },
  {
    max:
      cacheSizes["isDeferredFragment"] ||
      defaultCacheSizes["isDeferredFragment"],
  }
);

/** @internal */
export function isDeferredFragment(
  fragmentSelection: InlineFragmentNode | FragmentSpreadNode,
  variables: OperationVariables | undefined
): boolean {
  const result = memoized(fragmentSelection);
  return typeof result === "function" ? result(variables) : result;
}
