import type { TSTypeKind } from "ast-types/lib/gen/kinds";

import type { UtilContext } from "../types.js";

import { findReferences } from "./findReferences.js";

export function reorderGenericArguments({
  context,
  namespace,
  identifier,
  scope,
  newOrder,
  context: { j },
}: {
  namespace?: string;
  identifier: string;
  scope: any;
  /**
   * To reorder `<TData, TVariables>` to `<TVariables, TData>`, pass `[1, 0]`.
   * `[0, 1, 3]` would drop the third generic argument.
   */
  newOrder: number[];
  context: UtilContext;
}): void {
  findReferences({
    context,
    namespace,
    identifier,
    scope,
  }).forEach((path) => {
    j(path).closest(j.TSTypeReference);
    const parentPath = namespace ? path.parent.parent : path.parent;
    const parentNode = parentPath.node;
    if (
      !j.TSTypeReference.check(parentNode) ||
      !parentNode.typeParameters?.params
    ) {
      return;
    }
    let newParams: TSTypeKind[] = [];
    for (const idx of newOrder) {
      if (idx >= parentNode.typeParameters.params.length) {
        break;
      }
      newParams.push(parentNode.typeParameters.params[idx]);
    }
    parentNode.typeParameters.params = newParams;
  });
}
