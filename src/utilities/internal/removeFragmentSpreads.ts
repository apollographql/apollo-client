import type {
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from "graphql";
import { BREAK, Kind, visit } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";

import { createDirectiveNode } from "./createDirectiveNode.js";
import { createFragmentMap } from "./createFragmentMap.js";
import type { FragmentMap } from "./types/FragmentMap.js";

export declare namespace removeMaskedFragmentSpreads {
  export interface Options {
    /**
     * @internal
     * Determines whether to remove the fragment spread node or mark it for
     * removal later. `mark` is used with data masking and fragment arguments so
     * that caches can pass variables via the result object but have a way to
     * continue to mask the data.
     *
     * @defaultValue "remove"
     */
    mode?: "remove" | "mark";
  }
}

export function removeMaskedFragmentSpreads(
  document: DocumentNode,
  { mode = "remove" }: removeMaskedFragmentSpreads.Options = {}
) {
  const fragments = createFragmentMap(
    document.definitions.filter((def) => def.kind === Kind.FRAGMENT_DEFINITION)
  );

  return visit(document, {
    FragmentSpread(node) {
      if (!node.directives?.some(({ name }) => name.value === "unmask")) {
        switch (mode) {
          case "remove":
            return null;
          case "mark": {
            const fragment = fragments[node.name.value];

            if (
              !node.arguments?.length &&
              !fragment?.variableDefinitions?.length &&
              !hasVariables(fragment, fragments)
            ) {
              return null;
            }

            return {
              ...node,
              directives: [
                ...((node.directives ?? []) as DirectiveNode[]),
                createDirectiveNode("_apollo", { mask: true }),
              ],
            } satisfies FragmentSpreadNode;
          }
          default:
            if (__DEV__) {
              mode satisfies never;
            }
        }
      }
    },
  });
}

function hasVariables(
  fragment: FragmentDefinitionNode | undefined,
  fragmentMap: FragmentMap
) {
  if (!fragment) return false;

  let usesVariables = false;

  visit(fragment, {
    Variable() {
      usesVariables = true;
      return BREAK;
    },
    FragmentSpread(node) {
      usesVariables ||= hasVariables(fragmentMap[node.name.value], fragmentMap);
    },
  });

  return usesVariables;
}
