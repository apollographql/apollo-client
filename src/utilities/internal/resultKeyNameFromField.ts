import type { FieldNode } from "graphql";

/** @internal */
export function resultKeyNameFromField(field: FieldNode): string {
  return field.alias ? field.alias.value : field.name.value;
}
