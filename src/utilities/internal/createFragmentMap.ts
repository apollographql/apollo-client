import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionNode,
} from "graphql";

import { invariant } from "@apollo/client/utilities/invariant";

import type { FragmentMap } from "./types/FragmentMap.js";

/**
 * Utility function that takes a list of fragment definitions and makes a hash out of them
 * that maps the name of the fragment to the fragment definition.
 *
 * @internal */
export function createFragmentMap(
  fragments: FragmentDefinitionNode[] = []
): FragmentMap {
  const symTable: FragmentMap = {};
  fragments.forEach((fragment) => {
    symTable[fragment.name.value] = fragment;
  });
  return symTable;
}

/** @internal */
export type FragmentMapFunction = (
  fragmentName: string
) => FragmentDefinitionNode | null;

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
