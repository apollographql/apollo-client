import type { SelectionSetNode } from "graphql";
import { Kind } from "graphql";

// Note: this is a shallow dealias function. We might consider a future
// improvement of dealiasing all nested data. Until that need arises, we can
// keep this simple.
export function dealias(
  fieldValue: Record<string, any> | null | undefined,
  selectionSet: SelectionSetNode
) {
  if (!fieldValue) {
    return fieldValue;
  }

  const data = { ...fieldValue };

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD && selection.alias) {
      data[selection.name.value] = fieldValue[selection.alias.value];
      delete data[selection.alias.value];
    }
  }

  return data;
}
