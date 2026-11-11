import type { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";
import { getFragmentVariables } from "./getFragmentVariables.js";

export function getFragmentScope(
  fragmentSpread: FragmentSpreadNode,
  {
    fragment,
    variables,
    scope,
  }: {
    fragment: FragmentDefinitionNode;
    variables: OperationVariables | undefined;
    scope: OperationVariables | undefined;
  }
) {
  if (
    Kind.FRAGMENT_ARGUMENT === undefined ||
    !fragment.variableDefinitions?.length
  ) {
    return variables ?? {};
  }

  const operationScope = { ...variables };

  for (const def of fragment.variableDefinitions) {
    delete operationScope[def.variable.name.value];
  }

  return compact(
    operationScope,
    getFragmentVariables(fragmentSpread, { fragment, scope })
  );
}
