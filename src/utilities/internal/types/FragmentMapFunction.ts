import type { FragmentDefinitionNode } from "graphql";

/** @internal */
export type FragmentMapFunction = (
  fragmentName: string
) => FragmentDefinitionNode | null;
