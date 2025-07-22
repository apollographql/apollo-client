import type { TSESTree as AST } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";

import references from "../docs/public/canonical-references.json" with { type: "json" };

const referenceSet = new Set(references);

export const validInheritDoc = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    const source = context.sourceCode;
    let handled = new Set();
    return {
      "*"(node) {
        for (const comment of source.getCommentsBefore(node)) {
          if (handled.has(comment)) {
            continue;
          }
          handled.add(comment);
          if (comment.type === "Block") {
            const text = source.getText(comment);
            let match: RegExpMatchArray | null;
            if ((match = text.match(/@inheritDoc\s+([^\s}]+)/d))) {
              const canonicalReference = match[1];
              if (!referenceSet.has(canonicalReference)) {
                context.report({
                  node: comment,
                  loc: locForMatch(source, comment, match, 1),
                  messageId: "invalidCanonicalReference",
                });
              }
            }
            if (
              (match = text.match(/@inheritdoc/di)) &&
              match[0] !== "@inheritDoc"
            ) {
              const loc = locForMatch(source, comment, match, 0);
              context.report({
                node: comment,
                loc,
                messageId: "invalidSpelling",
                fix(fixer) {
                  return fixer.replaceTextRange(
                    [
                      source.getIndexFromLoc(loc.start),
                      source.getIndexFromLoc(loc.end),
                    ],
                    "@inheritDoc"
                  );
                },
              });
            }
          }
        }
      },
    };
  },
  meta: {
    messages: {
      invalidCanonicalReference: "Unknown canonical reference.",
      invalidSpelling: "Invalid spelling of @inheritDoc.",
    },
    type: "problem",
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});

export const validMdxCanonicalReferences = ESLintUtils.RuleCreator.withoutDocs({
  create(context, optionsWithDefault) {
    return {
      JSXAttribute(node: AST.JSXAttribute) {
        if (node.name.name == "canonicalReference") {
          const ref =
            node.value.type === "JSXExpressionContainer" ?
              node.value.expression
            : node.value;
          if (!ref || ref.type !== "Literal" || typeof ref.value !== "string") {
            context.report({
              node: ref || node,
              messageId: "shouldBeString",
            });
          } else if (!referenceSet.has(ref.value)) {
            context.report({
              node: ref,
              messageId: "invalidCanonicalReference",
            });
          }
        }
      },
    };
  },
  meta: {
    messages: {
      shouldBeString: "The canonicalReference value should be a string.",
      invalidCanonicalReference: "Unknown canonical reference.",
    },
    type: "problem",
    schema: [],
  },
  defaultOptions: [],
});

function locForMatch(
  source: SourceCode,
  node: AST.NodeOrTokenData,
  match: RegExpMatchArray,
  index: number
) {
  return {
    start: source.getLocFromIndex(
      source.getIndexFromLoc(node.loc.start) + match.indices[index][0]
    ),
    end: source.getLocFromIndex(
      source.getIndexFromLoc(node.loc.start) + match.indices[index][1]
    ),
  };
}
