import type { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";
import { valueToObjectRepresentation } from "./valueToObjectRepresentation.js";

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
  if (
    Kind.FRAGMENT_ARGUMENT === undefined ||
    !fragment.variableDefinitions ||
    !fragment.variableDefinitions.length
  ) {
    return {};
  }

  const scope: OperationVariables = {};
  const argumentsByName = new Map(
    fragmentSpread.arguments?.map((arg) => [arg.name.value, arg])
  );

  fragment.variableDefinitions.forEach((def) => {
    const name = def.variable.name;
    const argument = argumentsByName.get(name.value);

    if (argument) {
      valueToObjectRepresentation(scope, name, argument.value, parentScope);
    }

    if (
      (!Object.hasOwn(scope, name.value) || scope[name.value] === undefined) &&
      def.defaultValue
    ) {
      valueToObjectRepresentation(scope, name, def.defaultValue);
    }
  });

  return compact(scope);
}
