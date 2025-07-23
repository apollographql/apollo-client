import { ESLintUtils } from "@typescript-eslint/utils";

export const TVariablesShouldExtendOperationVariables =
  ESLintUtils.RuleCreator.withoutDocs({
    create(context) {
      return {
        TSTypeParameter(node) {
          if (node.parent.type !== "TSTypeParameterDeclaration") {
            return;
          }
          if (
            node.name.name === "TVariables" &&
            !(
              node.constraint &&
              node.constraint.type === "TSTypeReference" &&
              node.constraint.typeName.type === "Identifier" &&
              node.constraint.typeName.name === "OperationVariables"
            )
          ) {
            context.report({
              messageId: "TVariablesShouldExtendOperationVariables",
              node: node,
              fix:
                node.constraint ? undefined : (
                  (fixer) => {
                    return fixer.insertTextAfter(
                      node.name,
                      " extends OperationVariables"
                    );
                  }
                ),
            });
          }
        },
      };
    },
    meta: {
      messages: {
        TVariablesShouldExtendOperationVariables:
          "`TVariables` should extend `OperationVariables`.",
      },
      type: "problem",
      fixable: "code",
      schema: [],
    },
    defaultOptions: [],
  });

export const TDataTVariablesOrder = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    return {
      TSTypeParameter(node) {
        if (node.parent.type !== "TSTypeParameterDeclaration") {
          return;
        }
        if (node.name.name === "TData") {
          const tVariables = node.parent.params.find(
            (param) => param.name.name === "TVariables"
          );
          if (
            tVariables &&
            node.parent.params.indexOf(tVariables) -
              node.parent.params.indexOf(node) !==
              1
          ) {
            context.report({
              messageId: "TDataTVariablesOrder",
              node: node,
            });
          }
        }
      },
    };
  },
  meta: {
    messages: {
      TDataTVariablesOrder:
        "`TVariables` should follow directly after `TData`.",
    },
    type: "problem",
    schema: [],
  },
  defaultOptions: [],
});
