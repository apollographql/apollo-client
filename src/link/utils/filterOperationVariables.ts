import { VariableDefinitionNode, visit } from "graphql";

import { Operation } from "../core";

export function filterOperationVariables(variables: Record<string, any>, operation: Operation) {
  const result = { ...variables };
  const unusedNames = new Set(Object.keys(variables));
  visit(operation.query, {
    Variable(node, _key, parent) {
      // A variable type definition at the top level of a query is not
      // enough to silence server-side errors about the variable being
      // unused, so variable definitions do not count as usage.
      // https://spec.graphql.org/draft/#sec-All-Variables-Used
      if (parent && (parent as VariableDefinitionNode).kind !== 'VariableDefinition') {
        unusedNames.delete(node.name.value);
      }
    },
  });
  unusedNames.forEach(name => {
    delete result![name];
  });
  return result;
}
