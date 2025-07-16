import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree as AST } from "@typescript-eslint/types";

type Fn =
  | AST.FunctionDeclaration
  | AST.ArrowFunctionExpression
  | AST.FunctionExpression;

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    let depth = 1;
    let disabledDepth: number | false = false;

    function EnterFn() {
      depth++;
    }
    function ExitFn() {
      depth--;
      if (disabledDepth !== false && disabledDepth > depth) {
        disabledDepth = false;
      }
    }

    return {
      CallExpression(node) {
        const directCallee =
          node.callee.type === "Identifier" ? node.callee
          : node.callee.type === "MemberExpression" ? node.callee.property
          : null;

        if (
          directCallee?.type === "Identifier" &&
          directCallee.name === "disableActEnvironment"
        ) {
          if (disabledDepth === false) {
            disabledDepth = depth;
          }
        }

        if (
          directCallee?.type === "Identifier" &&
          (directCallee.name === "takeRender" ||
            directCallee.name === "takeSnapshot")
        ) {
          if (disabledDepth === false) {
            context.report({
              messageId: "missingDisableActEnvironment",
              node: node,
            });
          }
        }
      },
      ArrowFunctionExpression: EnterFn,
      FunctionExpression: EnterFn,
      FunctionDeclaration: EnterFn,
      "ArrowFunctionExpression:exit": ExitFn,
      "FunctionExpression:exit": ExitFn,
      "FunctionDeclaration:exit": ExitFn,
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
  return parentFunction as any;
}
