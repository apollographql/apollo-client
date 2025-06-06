import type { OperationDefinitionNode, ValueNode } from "graphql";

import { valueToObjectRepresentation } from "./valueToObjectRepresentation.js";

/** @internal */
export function getDefaultValues(
  definition: OperationDefinitionNode | undefined
): Record<string, any> {
  const defaultValues = {};
  const defs = definition && definition.variableDefinitions;
  if (defs && defs.length) {
    defs.forEach((def) => {
      if (def.defaultValue) {
        valueToObjectRepresentation(
          defaultValues,
          def.variable.name,
          def.defaultValue as ValueNode
        );
      }
    });
  }
  return defaultValues;
}
