import type { FragmentDefinitionNode } from "graphql";

import type { FragmentMap } from "./types/FragmentMap.js";

/**
 * Utility function that takes a list of fragment definitions and makes a hash out of them
 * that maps the name of the fragment to the fragment definition.
 *
 * @internal
 */
export function createFragmentMap(
  fragments: FragmentDefinitionNode[] = []
): FragmentMap {
  const symTable: FragmentMap = {};
  fragments.forEach((fragment) => {
    symTable[fragment.name.value] = fragment;
  });
  return symTable;
}
