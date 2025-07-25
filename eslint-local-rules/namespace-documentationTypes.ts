import type { TSESTree as AST } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";

export const enforceDocumentationTypes = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    const namespaces = [];
    const shouldBeDocumented: Record<
      string,
      {
        namespaces: string[];
        node: AST.TSTypeAliasDeclaration;
      }
    > = {};
    return {
      TSModuleDeclaration(node) {
        if (node.kind !== "namespace") {
          return;
        }
        namespaces.push(
          node.id.type === "Identifier" ? node.id.name : "<unknown>"
        );
      },
      "TSModuleDeclaration:exit"(node) {
        if (node.kind !== "namespace") {
          return;
        }
        namespaces.pop();
        for (const [name, entry] of Object.entries(shouldBeDocumented)) {
          if (entry.namespaces.length > namespaces.length) {
            delete shouldBeDocumented[name];
            context.report({
              node: entry.node.id,
              messageId: "shouldBeDocumented",
            });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.declaration) {
          return;
        }
        if (node.declaration.type === "TSTypeAliasDeclaration") {
          const name = node.declaration.id.name;
          if (name.endsWith("Result") || name.endsWith("Options")) {
            shouldBeDocumented[name] = {
              node: node.declaration,
              namespaces: [...namespaces],
            };
          }
        } else if (node.declaration.type === "TSInterfaceDeclaration") {
          const name = node.declaration.id.name;
          if (
            name in shouldBeDocumented &&
            namespaces.at(-1) === "DocumentationTypes"
          ) {
            delete shouldBeDocumented[name];
          }
        }
      },
    };
  },
  meta: {
    messages: {
      shouldBeDocumented:
        "This type should have an interface with the same name in a nested `DocumentationTypes` namespace.",
    },
    type: "problem",
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});
