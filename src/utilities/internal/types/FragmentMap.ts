import type { FragmentDefinitionNode } from "graphql";

/**
 * Describes a map from fragment names to fragment definitions.
 *
 * @internal
 */
export interface FragmentMap {
  [fragmentName: string]: FragmentDefinitionNode;
}
