import type { FieldNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { canonicalStringify } from "./canonicalStringify.js";
import { memoize } from "./memoize.js";

export const isStreamField = memoize(
  function isStreamField(
    field: FieldNode,
    variables: OperationVariables | undefined
  ) {
    return !!field.directives?.some((directive) => {
      if (directive.name.value !== "stream") {
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
    max: cacheSizes["isStreamField"] || defaultCacheSizes["isStreamField"],
    makeCacheKey: ([selection, variables]) => [
      selection,
      canonicalStringify(variables),
    ],
  }
);
