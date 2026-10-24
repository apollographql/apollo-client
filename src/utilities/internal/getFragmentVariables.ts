import type { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";

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
  if (!fragment.variableDefinitions || !fragment.variableDefinitions.length) {
    return variables ?? {};
  }

  const scope = { ...variables };
  const argumentsByName = new Map(
    fragmentSpread.arguments?.map((arg) => [arg.name.value, arg])
  );

  fragment.variableDefinitions.forEach((def) => {
    const name = def.variable.name;
    const argument = argumentsByName.get(name.value);

    // We want to prevent operation variables from leaking into the fragment
    // variables scope for any variables the fragment declares in its fragment
    // definition. If a fragment defines a variable, but no argument is given,
    // that value should be treated as `undefined` unless it has a default
    // value, even if it shadows a variable named the same from the operation.
    delete scope[name.value];

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
