import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift/src/core.js";

import type { IdentifierRename } from "../renames.js";
import type { ImportKind, UtilContext } from "../types.js";

import { entryPointAliases } from "./entryPointAliases.js";

const typeImportsFirst = (
  a: j.ASTPath<namedTypes.ImportDeclaration>,
  b: j.ASTPath<namedTypes.ImportDeclaration>
) =>
  a.value.importKind === "type" && b.value.importKind !== "type" ? -1
  : a.value.importKind !== "type" && b.value.importKind === "type" ? 1
  : 0;

export function findImportDeclarationFor({
  description,
  compatibleWith = "type",
  context: { j, source },
  exact = false,
}: {
  description: Pick<
    IdentifierRename["from"] & IdentifierRename["to"],
    "module" | "alternativeModules"
  >;
  compatibleWith?: ImportKind;
  context: UtilContext;
  exact?: boolean;
}): j.Collection<namedTypes.ImportDeclaration> {
  const test = (node: namedTypes.ImportDeclaration) => {
    const isValidImportKind =
      compatibleWith === "type" || node.importKind !== "type";
    const hasNamespaceImport =
      j(node).find(j.ImportNamespaceSpecifier).size() > 0;
    return isValidImportKind && !hasNamespaceImport;
  };
  const perfectMatch = source
    .find(
      j.ImportDeclaration,
      (node) => test(node) && description.module == "" + node.source.value
    )
    .paths()
    .sort(typeImportsFirst);
  const alternativeMatches = source
    .find(
      j.ImportDeclaration,
      (node) =>
        (test(node) &&
          description.alternativeModules?.includes("" + node.source.value)) ||
        false
    )
    .paths()
    .sort(typeImportsFirst);
  const fallback =
    entryPointAliases[description.module as keyof typeof entryPointAliases];
  const fallbackMatches =
    exact ?
      []
    : source
        .find(
          j.ImportDeclaration,
          (node) =>
            (test(node) && fallback?.includes("" + node.source.value)) || false
        )
        .paths()
        .sort(typeImportsFirst);
  return j(perfectMatch.concat(...alternativeMatches, ...fallbackMatches));
}
