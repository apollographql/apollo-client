import type { InlineFragmentNode, SelectionNode } from "graphql";

/** @internal */
export function isInlineFragment(
  selection: SelectionNode
): selection is InlineFragmentNode {
  return selection.kind === "InlineFragment";
}
