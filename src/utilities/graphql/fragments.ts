import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionNode,
} from "graphql";

import type { FragmentMap } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

export type FragmentMapFunction = (
  fragmentName: string
) => FragmentDefinitionNode | null;

export function getFragmentFromSelection(
  selection: SelectionNode,
  fragmentMap?: FragmentMap | FragmentMapFunction
): InlineFragmentNode | FragmentDefinitionNode | null {
  switch (selection.kind) {
    case "InlineFragment":
      return selection;
    case "FragmentSpread": {
      const fragmentName = selection.name.value;
      if (typeof fragmentMap === "function") {
        return fragmentMap(fragmentName);
      }
      const fragment = fragmentMap && fragmentMap[fragmentName];
      invariant(fragment, `No fragment named %s`, fragmentName);
      return fragment || null;
    }
    default:
      return null;
  }
}
