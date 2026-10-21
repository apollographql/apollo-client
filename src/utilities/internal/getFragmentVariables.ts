import type { FragmentSpreadNode } from "graphql";

import type { OperationVariables } from "@apollo/client";

import { argumentsObjectFromField } from "./argumentsObjectFromField.js";

export function getFragmentVariables(
  fragment: FragmentSpreadNode,
  {
    variables,
    parentScope,
  }: {
    variables: OperationVariables | undefined;
    parentScope?: OperationVariables;
  }
) {
  const fragmentArgs = argumentsObjectFromField(fragment, variables);
  return fragmentArgs ? { ...variables, ...fragmentArgs } : variables || {};
}
