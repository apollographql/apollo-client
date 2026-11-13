import type { OperationVariables } from "@apollo/client";

/**
 * @internal
 * The value stored under `fragmentInfoSymbol` on a result object.
 */
export interface FragmentInfo {
  operationVariables: OperationVariables;
  fragments: Record<
    string /* fragmentName */,
    { variables: OperationVariables }
  >;
}
