import { randomUUID } from "node:crypto";

import type { Transform } from "jscodeshift";

import type { IdentifierRename, ModuleRename } from "./renames.js";
import { renames } from "./renames.js";

type ImportKind = "type" | "value";

declare module "ast-types" {
  export namespace namedTypes {
    interface ImportSpecifier {
      importKind?: ImportKind;
    }
  }
}

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const combined: Record<string, boolean> = {};

  function findImportSpecifiersFor(
    description: IdentifierRename["from"] & IdentifierRename["to"],
    importKind: ImportKind = "value"
  ) {
    return findImportDeclarationFor(description, importKind).find(
      j.ImportSpecifier,
      (node) => {
        return (
          node.imported.name ===
            (description.namespace || description.identifier) &&
          (importKind === "type" || node.importKind !== "type")
        );
      }
    );
  }

  function findImportDeclarationFor(
    description: Pick<
      IdentifierRename["from"] & IdentifierRename["to"],
      "module" | "alternativeModules"
    >,
    importKind: ImportKind = "value"
  ) {
    return source.find(j.ImportDeclaration, (node) => {
      const moduleMatches =
        description.module == "" + node.source.value ||
        description.alternativeModules?.includes("" + node.source.value) ||
        false;
      const isValidImportKind =
        importKind === "type" || node.importKind !== "type";
      const hasNamespaceImport =
        j(node).find(j.ImportNamespaceSpecifier).size() > 0;
      return moduleMatches && isValidImportKind && !hasNamespaceImport;
    });
  }

  function getUnusedIdentifer() {
    let identifier: string;
    do {
      identifier = randomUUID().replace(/-/g, "_");
    } while (source.find(j.Identifier, { name: identifier }).size() > 0);
    return identifier;
  }

  let modified = false;
  for (const rename of renames) {
    if (!("importType" in rename)) {
      handleModuleRename(rename);
      continue;
    }
    handleIdentiferRename(rename);
  }
  return modified ? source.toSource() : undefined;

  function handleIdentiferRename(rename: IdentifierRename) {
    const { from, to } = rename;
    const final = { ...from, ...to };

    findImportSpecifiersFor(from).forEach((specifierPath) => {
      if (from.namespace && to.namespace) {
        throw new Error(
          "This case is not supported yet: " + JSON.stringify(rename)
        );
      } else if (from.namespace) {
        throw new Error(
          "This case is not supported yet: " + JSON.stringify(rename)
        );
      }

      modified = true;

      const localName = specifierPath.value.local?.name;
      const importedName = specifierPath.value.imported.name;
      const importDeclaration = j(specifierPath).closest(j.ImportDeclaration);
      const importType =
        specifierPath.value.importKind ||
        importDeclaration.nodes()[0].importKind ||
        rename.importType;
      if (importType === "typeof") {
        return; // typeof imports are not supported
      }

      // create a temporary const definition with the original "local name" of the import
      const tempId = getUnusedIdentifer();
      const tempDeclaration = j.variableDeclaration("const", [
        j.variableDeclarator(j.identifier("" + (localName || importedName))),
      ]);
      // insert the temporary declaration in the source
      importDeclaration.insertAfter(tempDeclaration);
      // find the inserted variable declaration from the source (required to be able to rename it)
      const tempVariable = source
        .find(j.VariableDeclaration, tempDeclaration)
        .find(j.VariableDeclarator);
      // rename the temporary variable to a temporary unique identifier
      tempVariable.renameTo(tempId);
      // and remove it
      tempVariable.remove();

      // undo accidental rename of the imported variable
      specifierPath.replace(
        j.importSpecifier(
          j.identifier("" + importedName),
          localName ? j.identifier("" + localName) : undefined
        )
      );

      // replace the unique identifier with the new correct variable access
      source
        .find(j.Identifier, {
          name: tempId,
        })
        .replaceWith(
          final.namespace ?
            j.memberExpression(
              j.identifier(final.namespace),
              j.identifier(final.identifier)
            )
          : j.identifier(final.identifier)
        );

      if (findImportSpecifiersFor(final, importType).size() > 0) {
        // if the target import specifier already exists, we can just remove this one
        specifierPath.replace();
      } else {
        const targetDeclaration = findImportDeclarationFor(
          final,
          importType
        ).nodes()[0];
        const newImportName = j.identifier(
          to.namespace || to.identifier || from.identifier
        );
        if (targetDeclaration === specifierPath.parent) {
          // specifierPath should have been removed anyways, so we just reuse it in the existing position
          specifierPath.node.name = newImportName;
          specifierPath.node.local = undefined;
        } else {
          // remove the specifier, we create a new one in a different import declaration
          specifierPath.replace();
          if (targetDeclaration) {
            const specifier = j.importSpecifier(newImportName);
            if (
              importType === "type" &&
              targetDeclaration.importKind !== "type"
            ) {
              specifier.importKind = "type";
            }
            (targetDeclaration.specifiers ??= []).push(specifier);
          } else {
            importDeclaration.insertAfter(
              j.importDeclaration(
                [j.importSpecifier(newImportName)],
                j.literal(to.module || from.module),
                importType
              )
            );
          }
        }
      }
      if (importDeclaration.size() === 0) {
        importDeclaration.remove();
      }
    });
  }

  function handleModuleRename(rename: ModuleRename) {
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
          modified = true;
          sourcePath.value.source.value = rename.to.module;
        });
    }

    function mergeIntoExistingOrRenameImport() {
      findImportDeclarationFor(rename.from).forEach((sourcePath) => {
        modified = true;
        const sourceImport = j(sourcePath);
        let targetImport = findImportDeclarationFor(rename.to)
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
      });
    }
  }
};

export default transform;
