import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { Kind } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";
import { hasDirectives } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

export function hasClientExports(document: DocumentNode) {
  return document && hasDirectives(["client", "export"], document, true);
}

/** @internal */
export function getFragmentMaskMode(
  fragment: FragmentSpreadNode
): "mask" | "migrate" | "unmask" {
  const directive = fragment.directives?.find(
    ({ name }) => name.value === "unmask"
  );

  if (!directive) {
    return "mask";
  }

  const modeArg = directive.arguments?.find(
    ({ name }) => name.value === "mode"
  );

  if (__DEV__) {
    if (modeArg) {
      if (modeArg.value.kind === Kind.VARIABLE) {
        invariant.warn("@unmask 'mode' argument does not support variables.");
      } else if (modeArg.value.kind !== Kind.STRING) {
        invariant.warn("@unmask 'mode' argument must be of type string.");
      } else if (modeArg.value.value !== "migrate") {
        invariant.warn(
          "@unmask 'mode' argument does not recognize value '%s'.",
          modeArg.value.value
        );
      }
    }
  }

  if (
    modeArg &&
    "value" in modeArg.value &&
    modeArg.value.value === "migrate"
  ) {
    return "migrate";
  }

  return "unmask";
}
