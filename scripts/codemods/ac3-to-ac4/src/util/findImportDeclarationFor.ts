import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift/src/core.js";

import type { IdentifierRename } from "../renames.js";
import type { ImportKind, UtilContext } from "../types.js";

export function findImportDeclarationFor({
  description,
  compatibleWith = "type",
  context: { j, source },
}: {
  description: Pick<
    IdentifierRename["from"] & IdentifierRename["to"],
    "module" | "alternativeModules"
  >;
  compatibleWith?: ImportKind;
  context: UtilContext;
}): j.Collection<namedTypes.ImportDeclaration> {
  const test = (node: namedTypes.ImportDeclaration) => {
    const isValidImportKind =
      compatibleWith === "type" || node.importKind !== "type";
    const hasNamespaceImport =
      j(node).find(j.ImportNamespaceSpecifier).size() > 0;
    return isValidImportKind && !hasNamespaceImport;
  };
  const perfectMatch = source.find(
    j.ImportDeclaration,
    (node) => test(node) && description.module == "" + node.source.value
  );
  const alternativeMatches = source.find(
    j.ImportDeclaration,
    (node) =>
      (test(node) &&
        description.alternativeModules?.includes("" + node.source.value)) ||
      false
  );
  return j(perfectMatch.paths().concat(...alternativeMatches.paths()));
  /**
   * {
   * const moduleMatches =
   * description.module == "" + node.source.value ||
   * description.alternativeModules?.includes("" + node.source.value) ||
   * false;
   */
}
