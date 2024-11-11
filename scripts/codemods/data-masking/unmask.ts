import type { Transform } from "jscodeshift";
import type { DirectiveNode, DocumentNode } from "graphql";
import { Kind, parse, visit, print } from "graphql";

const transform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);

  source
    .find(j.TaggedTemplateExpression, { tag: { name: "gql" } })
    .replaceWith((path) => {
      path.value.quasi.quasis = path.value.quasi.quasis.map((quasi) => {
        const queryString = quasi.value.cooked || quasi.value.raw;
        const document = parseGraphQL(queryString);

        if (document === null) {
          return quasi;
        }

        const whitespaceBefore = queryString.match(/^[\\n\s]*/)?.[0] ?? "";
        const whitespaceAfter = queryString.match(/[\\n\s]*$/)?.[0] ?? "";
        const spaces = whitespaceBefore.match(/[\\t ]+/)?.[0] ?? "";

        const str = print(transform(document));
        const final =
          whitespaceBefore +
          str
            .split("\n")
            .map((line, idx) => (idx === 0 ? line : spaces + line))
            .join("\n") +
          whitespaceAfter;

        quasi.value = {
          cooked: final,
          raw: final,
        };

        return quasi;
      });

      return path.value;
    });

  return source.toSource();

  function parseGraphQL(source: string) {
    try {
      return parse(source);
    } catch (e) {
      return null;
    }
  }

  function transform(document: DocumentNode) {
    return visit(document, {
      FragmentSpread: (node) => {
        if (
          node.directives?.some(
            (directive) => directive.name.value === "unmask"
          )
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
};

export default transform;
