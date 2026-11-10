import type { OperationVariables } from "@apollo/client";

/**
 * @internal
 * The value stored under `fragmentInfoSymbol` on a result object.
 */
export interface FragmentInfo {
  fragments: Record<
    string /* fragmentName */,
    { variables: OperationVariables }
  >;
}
