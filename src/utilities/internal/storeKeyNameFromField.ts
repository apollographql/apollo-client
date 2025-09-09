import type { FieldNode } from "graphql";

import { getStoreKeyName } from "./getStoreKeyName.js";
import { valueToObjectRepresentation } from "./valueToObjectRepresentation.js";

/** @internal */
export function storeKeyNameFromField(
  field: FieldNode,
  variables?: Object
): string {
  let directivesObj: any = null;
  if (field.directives) {
    directivesObj = {};
    field.directives.forEach((directive) => {
      directivesObj[directive.name.value] = {};

      if (directive.arguments) {
        directive.arguments.forEach(({ name, value }) =>
          valueToObjectRepresentation(
            directivesObj[directive.name.value],
            name,
            value,
            variables
          )
        );
      }
    });
  }

  let argObj: any = null;
  if (field.arguments && field.arguments.length) {
    argObj = {};
    field.arguments.forEach(({ name, value }) =>
      valueToObjectRepresentation(argObj, name, value, variables)
    );
  }

  return getStoreKeyName(field.name.value, argObj, directivesObj);
}
