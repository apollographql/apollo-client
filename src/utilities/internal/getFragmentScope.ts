import type { FragmentDefinitionNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";

export function getFragmentScope(
  fragment: FragmentDefinitionNode,
  {
    operationVariables,
    fragmentVariables,
  }: {
    operationVariables: OperationVariables | undefined;
    fragmentVariables: OperationVariables;
  }
) {
  if (
    Kind.FRAGMENT_ARGUMENT === undefined ||
    !fragment.variableDefinitions?.length
  ) {
    return operationVariables ?? {};
  }

  const globalScope = { ...operationVariables };

  for (const def of fragment.variableDefinitions) {
    delete globalScope[def.variable.name.value];
  }

  return compact(globalScope, fragmentVariables);
}
