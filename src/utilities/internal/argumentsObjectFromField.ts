import type { DirectiveNode, FieldNode, FragmentSpreadNode } from "graphql";

import { valueToObjectRepresentation } from "./valueToObjectRepresentation.js";

/** @internal */
export function argumentsObjectFromField(
  field: FieldNode | DirectiveNode | FragmentSpreadNode,
  variables?: Record<string, any>
): Object | null {
  if (field.arguments && field.arguments.length) {
    const argObj: Object = {};
    field.arguments.forEach(({ name, value }) =>
      valueToObjectRepresentation(argObj, name, value, variables)
    );
    return argObj;
  }
  return null;
}
