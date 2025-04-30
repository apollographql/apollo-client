import type { OperationVariables } from "@apollo/client";

/** @internal */
export type VariablesOption<TVariables extends OperationVariables> =
  {} extends TVariables ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };
