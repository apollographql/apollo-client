import type { FragmentDefinitionNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";

export function getFragmentScope(
  fragment: FragmentDefinitionNode,
  {
    variables,
    fragmentVariables,
  }: {
    variables: OperationVariables | undefined;
    fragmentVariables: OperationVariables;
  }
) {
  if (
    Kind.FRAGMENT_ARGUMENT === undefined ||
    !fragment.variableDefinitions?.length
  ) {
    return variables ?? {};
  }

  const globalScope = { ...variables };

  for (const def of fragment.variableDefinitions) {
    delete globalScope[def.variable.name.value];
  }

  return compact(globalScope, fragmentVariables);
}
