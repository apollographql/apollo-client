import type { FieldNode } from "graphql";

export function isTypenameField(field: FieldNode) {
  return field.name.value === "__typename";
}
