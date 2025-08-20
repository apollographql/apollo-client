import type { ModuleRename } from "../renames.js";
import type { UtilContext } from "../types.js";

import { findImportDeclarationFor } from "./findImportDeclarationFor.js";

export function handleModuleRename({
  rename,
  onModify,
  context,
  context: { j, source },
}: {
  onModify: () => void;
  rename: ModuleRename;
  context: UtilContext;
}) {
  renameNamespaceOrSideEffectImports();
  mergeIntoExistingOrRenameImport();

  function renameNamespaceOrSideEffectImports() {
    source
      .find(
        j.ImportDeclaration,
        (node) =>
          node.source.value === rename.from.module &&
          (!node.specifiers ||
            node.specifiers.some(
              (specifier) => specifier.type === "ImportNamespaceSpecifier"
            ))
      )
      .forEach((sourcePath) => {
        if (sourcePath.node.source.value == rename.to.module) {
          return; // No change needed.
        }
        onModify();
        sourcePath.get("value", "source").replace(j.literal(rename.to.module));
      });
  }

  function mergeIntoExistingOrRenameImport() {
    findImportDeclarationFor({ description: rename.from, context }).forEach(
      (sourcePath) => {
        if (sourcePath.node.source.value == rename.to.module) {
          return; // No change needed.
        }
        onModify();
        const sourceImport = j(sourcePath);
        let targetImport = findImportDeclarationFor({
          description: rename.to,
          context,
          exact: true,
        })
          .filter(
            (declaration) =>
              declaration.value.importKind === sourcePath.value.importKind
          )
          .nodes()[0];
        if (!targetImport) {
          targetImport = j.importDeclaration(
            [],
            j.literal(rename.to.module),
            sourcePath.value.importKind
          );
          sourceImport.insertAfter(targetImport);
        }
        sourceImport.find(j.ImportSpecifier).forEach((specifierPath) => {
          (targetImport.specifiers ??= []).push(specifierPath.value);
        });
        sourceImport.remove();
      }
    );
  }
}
