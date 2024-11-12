import type { Transform } from "jscodeshift";
import type { DirectiveNode, DocumentNode } from "graphql";
import { Kind, parse, visit, print } from "graphql";

const LEADING_WHITESPACE = /^[\\n\s]*/;
const TRAILING_WHITESPACE = /[\\n\s]*$/;
const INDENTATION = /[\\t ]+/;

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);

  source
    .find(j.TaggedTemplateExpression, { tag: { name: "gql" } })
    .forEach((taggedTemplateExpressionPath) => {
      j(taggedTemplateExpressionPath)
        .find(j.TemplateElement)
        .replaceWith((templateElementPath) => {
          const templateElement = templateElementPath.value;
          const queryString =
            templateElement.value.cooked || templateElement.value.raw;
          const document = parseDocument(queryString);

          if (document === null) {
            return templateElement;
          }

          const query = applyWhitespaceFrom(
            queryString,
            print(addUnmaskDirective(document))
          );

          return j.templateElement(
            {
              raw: String.raw({ raw: [query] }),
              cooked: query,
            },
            templateElement.tail
          );
        });
    });

  return source.toSource();
};

function parseDocument(source: string) {
  try {
    return parse(source);
  } catch (e) {
    return null;
  }
}

function applyWhitespaceFrom(source: string, target: string) {
  const leadingWhitespace = source.match(LEADING_WHITESPACE)?.at(0) ?? "";
  const trailingWhitespace = source.match(TRAILING_WHITESPACE)?.at(0) ?? "";
  const indentation = leadingWhitespace.match(INDENTATION)?.at(0) ?? "";

  return (
    leadingWhitespace +
    target
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : indentation + line))
      .join("\n") +
    trailingWhitespace
  );
}

function addUnmaskDirective(document: DocumentNode) {
  return visit(document, {
    FragmentSpread: (node) => {
      if (
        node.directives?.some((directive) => directive.name.value === "unmask")
      ) {
        return;
      }

      return {
        ...node,
        directives: [
          ...(node.directives || []),
          {
            kind: Kind.DIRECTIVE,
            name: { kind: Kind.NAME, value: "unmask" },
          } satisfies DirectiveNode,
        ],
      };
    },
  });
}

export default transform;
