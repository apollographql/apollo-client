import type { FieldNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { memoize } from "./memoize.js";

/** @internal */
const memoized = memoize(
  function (
    field: FieldNode
  ): boolean | ((variables: OperationVariables | undefined) => boolean) {
    const directive = field.directives?.find(
      (directive) => directive.name.value === "stream"
    );
    if (!directive) return false;

    for (const arg of directive.arguments ?? []) {
      if (arg.name.value === "if") {
        switch (arg.value.kind) {
          case Kind.BOOLEAN:
            return arg.value.value;
          case Kind.VARIABLE: {
            const varName = arg.value.name.value;
            return (variables) => !!variables?.[varName];
          }
        }
      }
    }

    return true;
  },
  {
    max: cacheSizes["isStreamField"] || defaultCacheSizes["isStreamField"],
  }
);

/** @internal */
export function isStreamField(
  field: FieldNode,
  variables: OperationVariables | undefined
): boolean {
  const result = memoized(field);
  return typeof result === "function" ? result(variables) : result;
}
isStreamField.memoized = memoized;
