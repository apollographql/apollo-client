import type { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { argumentsObjectFromField } from "./argumentsObjectFromField.js";
import { compact } from "./compact.js";
import { getDefaultValues } from "./getDefaultValues.js";

export function getFragmentVariables(
  fragmentSpread: FragmentSpreadNode,
  {
    fragment,
    variables,
    parentScope = variables,
  }: {
    fragment: FragmentDefinitionNode;
    variables: OperationVariables | undefined;
    parentScope?: OperationVariables;
  }
) {
  const operationVariables = { ...variables };
  const fragmentArgs: Record<string, any> =
    argumentsObjectFromField(fragmentSpread, parentScope) ?? {};
  const declaredArgs: Record<string, any> = {};

  fragment.variableDefinitions?.forEach((def) => {
    const name = def.variable.name.value;

    // We want to prevent operation variables from leaking into the fragment
    // variables scope for any variables the fragment declares in its fragment
    // definition. If a fragment defines a variable, but no argument is given,
    // that value should be treated as `undefined`, even if it shadows a
    // variable named the same from the operation.
    delete operationVariables[name];

    // Only keep arguments that the fragment declares via its variable
    // definitions and throw everything else away since graphql.js ignores them.
    declaredArgs[name] = fragmentArgs[name];
  });

  return compact(operationVariables, getDefaultValues(fragment), declaredArgs);
}
