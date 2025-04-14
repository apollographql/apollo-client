import { ESLintUtils } from "@typescript-eslint/utils";

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
          (directCallee.name === "act" || directCallee.name === "actAsync")
        ) {
          if (disabledDepth !== false) {
            context.report({
              messageId: "forbiddenActInNonActEnvironment",
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
      forbiddenActInNonActEnvironment:
        "`act` should not be called in a `disableActEnvironment`.",
    },
    type: "problem",
    schema: [],
  },
  defaultOptions: [],
});
