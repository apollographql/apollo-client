import { ESLintUtils } from "@typescript-eslint/utils";
import ts from "typescript";

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    return {
      VariableDeclaration(node) {
        for (const declarator of node.declarations) {
          if (!declarator.init) continue;
          const services = ESLintUtils.getParserServices(context);
          const type = services.getTypeAtLocation(declarator.init);
          for (const typePart of type.isUnion() ? type.types : [type]) {
            // is object type
            if (!type || !(type.flags & ts.TypeFlags.Object)) {
              continue;
            }
            if (
              // bad check, but will do for now
              // in the future, we should check for a `[Symbol.disposable]` property
              // but I have no idea how to use that right now
              typePart.symbol.escapedName === "Disposable" &&
              node.kind != "using"
            ) {
              context.report({
                messageId: "missingUsing",
                node: declarator,
              });
            }
            if (
              // bad check
              typePart.symbol.escapedName === "AsyncDisposable" &&
              node.kind != "await using"
            ) {
              context.report({
                messageId: "missingAwaitUsing",
                node: declarator,
              });
            }
          }
        }
      },
    };
  },
  meta: {
    messages: {
      missingUsing:
        "Disposables should be allocated with `using <disposable>`.",
      missingAwaitUsing:
        "AsyncDisposables should be allocated with `await using <disposable>`.",
    },
    type: "suggestion",
    schema: [],
  },
  defaultOptions: [],
});
