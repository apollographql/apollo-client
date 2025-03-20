import type { OperationVariables } from "@apollo/client/core";
import type { OnlyRequiredProperties } from "@apollo/client/utilities";

/* Common types */

export type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: Record<string, never>;
    }
  : Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };
