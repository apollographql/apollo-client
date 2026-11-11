import type { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";
import { Kind } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";
import { valueToObjectRepresentation } from "./valueToObjectRepresentation.js";

export function getFragmentVariables(
  fragmentSpread: FragmentSpreadNode,
  {
    fragment,
    scope,
  }: {
    fragment: FragmentDefinitionNode;
    scope?: OperationVariables;
  }
) {
  if (
    Kind.FRAGMENT_ARGUMENT === undefined ||
    !fragment.variableDefinitions ||
    !fragment.variableDefinitions.length
  ) {
    return {};
  }

  const variables: OperationVariables = {};
  const argumentsByName = new Map(
    fragmentSpread.arguments?.map((arg) => [arg.name.value, arg])
  );

  fragment.variableDefinitions.forEach((def) => {
    const name = def.variable.name;
    const argument = argumentsByName.get(name.value);

    if (argument) {
      valueToObjectRepresentation(variables, name, argument.value, scope);
    }

    if (
      (!Object.hasOwn(variables, name.value) ||
        variables[name.value] === undefined) &&
      def.defaultValue
    ) {
      valueToObjectRepresentation(variables, name, def.defaultValue);
    }
  });

  return compact(variables);
}
