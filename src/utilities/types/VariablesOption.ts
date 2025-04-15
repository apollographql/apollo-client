import type { OperationVariables } from "@apollo/client";

import type { OnlyRequiredProperties } from "./OnlyRequiredProperties.js";

export type VariablesOption<TVariables extends OperationVariables> =
  Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };
