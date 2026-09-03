import type { ScalarType } from "@apollo/client/cache";

/** @internal */
export function matchScalarList(scalarType: ScalarType) {
  return scalarType.match(/^\[(.*)\]$/);
}
