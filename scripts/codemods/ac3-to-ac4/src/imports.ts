import assert from "node:assert";

import type { namedTypes } from "ast-types";
import type { Transform } from "jscodeshift";
import type * as j from "jscodeshift";

import type { IdentifierRename, ModuleRename } from "./renames.js";
import { renames } from "./renames.js";
import { findReferences } from "./util/findReferences.js";

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

  let modified = false;
  for (const rename of renames) {
    if (!("importType" in rename)) {
      handleModuleRename(rename);
      continue;
    }
    handleIdentiferRename(rename);
  }
  return modified ? source.toSource() : undefined;

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
    compatibleWith: ImportKind = "type"
  ): j.Collection<namedTypes.ImportDeclaration> {
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

  function getUnusedIdentifier(similarTo: string) {
    let identifier = similarTo;
    let counter = 0;
    while (source.find(j.Identifier, { name: identifier }).size() > 0) {
      identifier = `${similarTo}_${++counter}`;
    }
    return identifier;
  }

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
      const alreadyImported = findImportSpecifiersFor(final, importType);
      let importAs = final.namespace || final.identifier;
      if (alreadyImported.size() > 0) {
        importAs = getLocalName(alreadyImported.nodes()[0]);
      } else if (getLocalName(specifier) !== importAs) {
        getUnusedIdentifier(importAs);
      }

      try {
        if (
          from.namespace === final.namespace &&
          localName !== importedName &&
          importedFrom === final.module
        ) {
          // simple case - we just need to rename the import, everything else stays the same
          specifierPath.get("imported").replace(j.identifier(final.identifier));

          return;
        }

        if (final.namespace) {
          moveGlobalIdentifierToNamespaceAccess(
            specifierPath.get("local") || specifierPath.get("imported"),
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
          specifierPath
            .get("imported")
            .replace(j.identifier(final.namespace || final.identifier));
          specifierPath.get("local").replace(j.identifier(importAs));

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
      } finally {
        rename.postProcess?.({
          j,
          namespace: final.namespace ? importAs : undefined,
          identifier: final.namespace ? final.identifier : importAs,
          renamedSpecifierPath: source
            .find(
              j.ImportSpecifier,
              (node) => (node.local?.name || node.imported.name) === importAs
            )
            .paths()[0],
        });
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
    globalIdentifer: j.ASTPath<namedTypes.Identifier>,
    namespace: string,
    namespaceProp: string
  ) {
    findReferences({
      j,
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
          sourcePath
            .get("value", "source")
            .replace(j.literal(rename.to.module));
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
