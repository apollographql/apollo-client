import type * as j from "jscodeshift/src/core.js";

import type { IdentifierRename } from "../renames.js";
import type { ImportKind, UtilContext } from "../types.js";

import { findImportDeclarationFor } from "./findImportDeclarationFor.js";
import { findImportSpecifiersFor } from "./findImportSpecifiersFor.js";

export function findOrInsertImport({
  context,
  context: { j, source },
  description,
  compatibleWith,
  after,
}: {
  context: UtilContext;
  description: IdentifierRename["from"];
  compatibleWith: ImportKind;
  after?: j.Collection<any>;
}) {
  const found = findImportSpecifiersFor({
    description,
    context,
    compatibleWith,
  }).nodes()[0];
  if (found) {
    return found;
  }
  let addInto = findImportDeclarationFor({
    description,
    context,
    compatibleWith,
  }).nodes()[0];
  if (!addInto) {
    addInto = j.importDeclaration.from({
      specifiers: [],
      source: j.literal(description.module),
      importKind: compatibleWith,
    });
    if (!after) {
      after = source.find(j.ImportDeclaration);
    }
    if (!after || after.size() === 0) {
      const program = source.find(j.Program).nodes()[0]!;
      program.body.unshift(addInto);
    } else {
      after.at(-1).insertAfter(addInto);
    }
  }
  const spec = j.importSpecifier.from({
    imported: j.identifier(description.identifier),
  });
  (addInto.specifiers ??= []).push(spec);
  return spec;
}
