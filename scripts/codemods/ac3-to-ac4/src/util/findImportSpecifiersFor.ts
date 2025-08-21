import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";

import type { IdentifierRename } from "../renames.js";
import type { ImportKind, UtilContext } from "../types.js";

import { findImportDeclarationFor } from "./findImportDeclarationFor.js";

export function findImportSpecifiersFor({
  description,
  compatibleWith = "type",
  context,
  context: { j },
}: {
  description: IdentifierRename["from"] & IdentifierRename["to"];
  compatibleWith?: ImportKind;
  context: UtilContext;
}) {
  return findImportDeclarationFor({
    description,
    compatibleWith,
    context,
  }).find(j.ImportSpecifier, (node) => {
    return (
      node.imported.name ===
        (description.namespace || description.identifier) &&
      (compatibleWith === "type" || node.importKind !== "type")
    );
  });
}
