import assert from "assert";

import { getLocalName } from "../imports.js";
import type { IdentifierRename } from "../renames.js";
import type { UtilContext } from "../types.js";

import { findImportDeclarationFor } from "./findImportDeclarationFor.js";
import { findImportSpecifiersFor } from "./findImportSpecifiersFor.js";
import { getUnusedIdentifier } from "./getUnusedIdentifier.js";
import { moveGlobalIdentifierToNamespaceAccess } from "./moveGlobalIdentifierToNamespaceAccess.js";
import { pick } from "./pick.js";
import { renameGlobalIdentifier } from "./renameGlobalIdentifier.js";

export function handleIdentiferRename({
  rename,
  context,
  context: { j, source },
  onModify,
}: {
  rename: IdentifierRename;
  context: UtilContext;
  onModify: () => void;
}) {
  const { from, to } = rename;
  const final = { ...from, ...to };

  findImportSpecifiersFor({ description: from, context }).forEach(
    (specifierPath) => {
      assert(
        !from.namespace,
        "This case is not supported yet: " + JSON.stringify(rename)
      );

      onModify();

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
      const alreadyImported = findImportSpecifiersFor({
        description: final,
        compatibleWith: importType,
        context,
      });
      let importAs = final.namespace || final.identifier;
      if (alreadyImported.size() > 0) {
        importAs = getLocalName(alreadyImported.nodes()[0]);
      } else if (getLocalName(specifier) !== importAs) {
        getUnusedIdentifier({ similarTo: importAs, context });
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
          moveGlobalIdentifierToNamespaceAccess({
            globalIdentifer:
              specifierPath.get("local") || specifierPath.get("imported"),
            namespace: importAs,
            namespaceProp: final.identifier,
            context,
          });
        } else if (renameFrom !== importAs) {
          renameGlobalIdentifier({
            identifierName: renameFrom,
            newName: importAs,
            context,
          });
        }

        if (alreadyImported.size() > 0) {
          // if the target import specifier already exists, we can just remove this one
          specifierPath.replace(
            // but keep comments in place
            j.emptyStatement.from(pick(specifier, "comments"))
          );
        } else {
          const targetDeclaration = findImportDeclarationFor({
            description: final,
            compatibleWith: importType,
            context,
          }).nodes()[0];
          // specifier should have been removed anyways, so we just reuse it in the existing position
          // this also moves comments around
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
        if (importDeclarations.find(j.ImportSpecifier).size() === 0) {
          importDeclarationPath.replace(
            // when removing the import declaration, try to keep comments
            // in place - we don't know if they really were attached
            // to the import declaration or "just there"
            j.emptyStatement.from(pick(importDeclaration, "comments"))
          );
        }
      } finally {
        rename.postProcess?.({
          context,
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
    }
  );
}
