import type { FragmentSpreadNode, InlineFragmentNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

export function isDeferredFragment(
  fragmentSelection: InlineFragmentNode | FragmentSpreadNode,
  variables: OperationVariables
) {
  return !!fragmentSelection.directives?.some((directive) => {
    if (directive.name.value !== "defer") {
      return false;
    }

    if (!directive.arguments) {
      return true;
    }

    for (const arg of directive.arguments) {
      if (arg.name.value === "if") {
        switch (arg.value.kind) {
          case Kind.BOOLEAN:
            return arg.value.value;
          case Kind.VARIABLE:
            return variables[arg.value.name.value];
          default:
            return false;
        }
      }
    }
  });
}
