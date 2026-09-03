import type { ScalarType } from "@apollo/client/cache";

export function matchScalarList(scalarType: ScalarType) {
  return scalarType.match(/^\[(.*)\]$/);
}
