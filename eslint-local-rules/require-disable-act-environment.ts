import { ESLintUtils, ASTUtils } from "@typescript-eslint/utils";
import type { TSESTree as AST } from "@typescript-eslint/types";

type Fn =
  | AST.FunctionDeclaration
  | AST.ArrowFunctionExpression
  | AST.FunctionExpression;

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    const functionsWithRenderStreamCall = new WeakMap<Fn, AST.CallExpression>();
    const functionsWithDisabledActEnvironment = new WeakSet<Fn>();
    function FunctionExitCheck(fnNode: Fn) {
      const callNode = functionsWithRenderStreamCall.get(fnNode);
      if (callNode) {
        if (!functionsWithDisabledActEnvironment.has(fnNode)) {
          context.report({
            messageId: "missingDisableActEnvironment",
            node: callNode,
          });
        }
      }
      functionsWithDisabledActEnvironment.delete(fnNode);
      functionsWithRenderStreamCall.delete(fnNode);
    }

    return {
      CallExpression(node) {
        const directCallee =
          node.callee.type === "Identifier" ? node.callee
          : node.callee.type === "MemberExpression" ? node.callee.property
          : null;

        if (
          directCallee?.type === "Identifier" &&
          (directCallee.name === "takeRender" ||
            directCallee.name === "takeSnapshot")
        ) {
          const parentFunction = findParentFunction(node);
          if (
            parentFunction &&
            !functionsWithRenderStreamCall.has(parentFunction)
          ) {
            functionsWithRenderStreamCall.set(parentFunction, node);
          }
        }

        if (
          directCallee?.type === "Identifier" &&
          directCallee.name === "disableActEnvironment"
        ) {
          const parentFunction = findParentFunction(node);
          if (parentFunction) {
            functionsWithDisabledActEnvironment.add(parentFunction);
          }
        }
      },
      "ArrowFunctionExpression:exit": FunctionExitCheck,
      "FunctionExpression:exit": FunctionExitCheck,
      "FunctionDeclaration:exit": FunctionExitCheck,
    };
  },
  meta: {
    messages: {
      missingDisableActEnvironment:
        "Tests using a render stream should call `disableActEnvironment`.",
    },
    type: "problem",
    schema: [],
  },
  defaultOptions: [],
});

function findParentFunction(node: AST.Node): Fn | undefined {
  let parentFunction: AST.Node | undefined = node;
  while (
    parentFunction != null &&
    parentFunction.type !== "FunctionDeclaration" &&
    parentFunction.type !== "FunctionExpression" &&
    parentFunction.type !== "ArrowFunctionExpression"
  ) {
    parentFunction = parentFunction.parent;
  }
  return parentFunction;
}
