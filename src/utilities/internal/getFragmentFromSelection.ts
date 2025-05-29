import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionNode,
} from "graphql";

import { invariant } from "@apollo/client/utilities/invariant";

import type { FragmentMap } from "./types/FragmentMap.js";
import type { FragmentMapFunction } from "./types/FragmentMapFunction.js";

/** @internal */
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
