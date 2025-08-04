import assert from "node:assert";
import { randomUUID } from "node:crypto";

import type { namedTypes } from "ast-types";
import type { Transform } from "jscodeshift";
import type * as j from "jscodeshift";

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
    compatibleWith: ImportKind = "value"
  ) {
    return findImportDeclarationFor(description, compatibleWith).find(
      j.ImportSpecifier,
      (node) => {
        return (
          node.imported.name ===
            (description.namespace || description.identifier) &&
          (compatibleWith === "type" || node.importKind !== "type")
        );
      }
    );
  }

  function findImportDeclarationFor(
    description: Pick<
      IdentifierRename["from"] & IdentifierRename["to"],
      "module" | "alternativeModules"
    >,
    compatibleWith: ImportKind = "value"
  ) {
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

  function getUnusedIdentifer(similarTo?: string) {
    let identifier = similarTo;
    let counter = 0;
    while (
      !identifier ||
      source.find(j.Identifier, { name: identifier }).size() > 0
    ) {
      identifier =
        similarTo ?
          `${similarTo}_${++counter}`
        : `_${randomUUID().replace(/-/g, "_")}`;
    }
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
      assert(
        !from.namespace,
        "This case is not supported yet: " + JSON.stringify(rename)
      );

      modified = true;

      const specifier = specifierPath.value;
      const localName = specifier.local?.name;
      const importedName = specifier.imported.name;
      const importDeclarations = j(specifierPath).closest(j.ImportDeclaration);
      const importDeclarationPath = importDeclarations.paths()[0];
      const importDeclaration = importDeclarationPath.value;
      const importedFrom = importDeclaration.source.value;
      const importType =
        specifier.importKind ||
        importDeclaration.importKind ||
        rename.importType;
      if (importType === "typeof") {
        return; // typeof imports are not supported, skip
      }
      const renameFrom = getLocalName(specifier);
      let importAs = getUnusedIdentifer(final.namespace || final.identifier);
      console.log(final);
      const alreadyImported = findImportSpecifiersFor(final, importType);
      if (alreadyImported.size() > 0) {
        importAs = getLocalName(alreadyImported.nodes()[0]);
      }

      if (
        from.namespace === final.namespace &&
        localName !== importedName &&
        importedFrom === final.module
      ) {
        // simple case - we just need to rename the import, everything else stays the same
        specifier.imported.name = final.identifier;
        return;
      }

      if (final.namespace) {
        moveGlobalIdentifierToNamespaceAccess(
          renameFrom,
          importAs,
          final.identifier
        );
      } else if (renameFrom !== importAs) {
        renameGlobalIdentifier(renameFrom, importAs);
      }

      if (alreadyImported.size() > 0) {
        // if the target import specifier already exists, we can just remove this one
        specifierPath.replace();
      } else {
        const targetDeclaration = findImportDeclarationFor(
          final,
          importType
        ).nodes()[0];
        // specifier should have been removed anyways, so we just reuse it in the existing position
        specifier.imported = j.identifier(final.namespace || final.identifier);
        specifier.local = j.identifier(importAs);

        if (targetDeclaration !== specifierPath.parent) {
          // remove the specifier, we create a new one in a different import declaration
          specifierPath.replace();
          if (targetDeclaration) {
            (targetDeclaration.specifiers ??= []).push(specifier);
          } else {
            importDeclarations.insertAfter(
              j.importDeclaration(
                [specifier],
                j.literal(to.module || from.module),
                importType
              )
            );
          }
        }
      }
      if (importDeclaration.specifiers?.length === 0) {
        importDeclarationPath.replace();
      }
    });
  }

  function renameGlobalIdentifier(identifierName: string, newName: string) {
    // create a temporary const definition with the original "local name" of the import
    const tempDeclaration = j.variableDeclaration("const", [
      j.variableDeclarator(j.identifier(identifierName)),
    ]);
    // insert the temporary declaration in the source
    source.find(j.Program).nodes()[0].body.unshift(tempDeclaration);
    // find the inserted variable declaration from the source (required to be able to rename it)
    const tempVariable = source
      .find(j.VariableDeclaration, tempDeclaration)
      .find(j.VariableDeclarator);
    // rename the temporary variable to a temporary unique identifier
    tempVariable.renameTo(newName);
    // and remove it
    tempVariable.remove();
  }

  function moveGlobalIdentifierToNamespaceAccess(
    globalIdentifer: string,
    namespace: string,
    namespaceProp: string
  ) {
    const tempId = getUnusedIdentifer();
    renameGlobalIdentifier(globalIdentifer, tempId);
    source
      .find(j.Identifier, { name: tempId })
      .filter((node) => {
        return node.parentPath.value.type !== "ImportSpecifier";
      })
      .replaceWith(
        j.memberExpression(j.identifier(namespace), j.identifier(namespaceProp))
      );
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

function getLocalName(spec: j.ImportSpecifier): string {
  return "" + (spec.local?.name || spec.imported.name);
}

export default transform;
