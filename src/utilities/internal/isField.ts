import type { FieldNode, SelectionNode } from "graphql";

/** @internal */
export function isField(selection: SelectionNode): selection is FieldNode {
  return selection.kind === "Field";
}
