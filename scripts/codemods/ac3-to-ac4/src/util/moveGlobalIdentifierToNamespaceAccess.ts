import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift/src/core.js";

import type { UtilContext } from "../types.js";

import { findReferences } from "./findReferences.js";

export function moveGlobalIdentifierToNamespaceAccess({
  globalIdentifer,
  namespace,
  namespaceProp,
  context: { j },
  context,
}: {
  globalIdentifer: j.ASTPath<namedTypes.Identifier>;
  namespace: string;
  namespaceProp: string;
  context: UtilContext;
}) {
  findReferences({
    context,
    identifier: globalIdentifer.node.name,
    scope: globalIdentifer.scope,
  })
    .filter((node) => {
      return node.parentPath.value.type !== "ImportSpecifier";
    })
    .forEach((node) => {
      if (j(node).closest(j.TSTypeReference).size() > 0) {
        node.replace(
          j.tsQualifiedName(
            j.identifier(namespace),
            j.identifier(namespaceProp)
          )
        );
      } else {
        node.replace(
          j.memberExpression(
            j.identifier(namespace),
            j.identifier(namespaceProp)
          )
        );
      }
    });
}
