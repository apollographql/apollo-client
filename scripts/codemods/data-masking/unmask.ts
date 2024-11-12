import type { Collection, Transform, TemplateLiteral } from "jscodeshift";
import type { DirectiveNode, DocumentNode } from "graphql";
import { Kind, parse, visit, print } from "graphql";
import path from "node:path";

const LEADING_WHITESPACE = /^[\s\t]*(?=[\S\n])/;
const TRAILING_WHITESPACE = /(?<=[\S\n])[\s\t]*$/;

const DEFAULT_TAGS = ["gql", "graphql"];

const transform: Transform = function transform(file, api, options) {
  const { tag = DEFAULT_TAGS, mode } = options;

  if (mode && mode !== "migrate") {
    console.warn(
      `The option --mode '${mode}' is not supported. Please use --mode 'migrate' to enable migrate mode for the @ummask directive.`
    );
  }

  const extname = path.extname(file.path);

  if (extname === ".graphql" || extname === ".gql") {
    return transformGraphQLFile(file.source, mode);
  }

  const j = api.jscodeshift;
  const source = j(file.source);

  const tagNames = Array.isArray(tag) ? tag : [tag];

  tagNames.forEach((tagName) => {
    addUnmaskToTaggedTemplate(tagName);
    addUnmaskToFunctionCall(tagName);
  });

  return source.toSource();

  function addUnmaskToFunctionCall(name: string) {
    source
      .find(j.CallExpression, {
        callee: { name },
        arguments: [{ type: "TemplateLiteral" }],
      })
      .forEach((p) => {
        addUnmaskToTemplateLiteral(j(p.value.arguments[0]));
      });
  }

  function addUnmaskToTaggedTemplate(name: string) {
    source
      .find(j.TaggedTemplateExpression, { tag: { name } })
      .forEach((taggedTemplateExpressionPath) => {
        addUnmaskToTemplateLiteral(
          j(taggedTemplateExpressionPath).find(j.TemplateLiteral)
        );
      });
  }

  function addUnmaskToTemplateLiteral(template: Collection<TemplateLiteral>) {
    template.find(j.TemplateElement).replaceWith((templateElementPath) => {
      const templateElement = templateElementPath.value;
      const queryString =
        templateElement.value.cooked || templateElement.value.raw;
      const document = parseDocument(queryString);

      if (document === null) {
        return templateElement;
      }

      const query = applyWhitepaceFromOriginalQuery(
        queryString,
        print(addUnmaskDirective(document, mode))
      );

      return j.templateElement(
        {
          raw: String.raw({ raw: [query] }),
          cooked: query,
        },
        templateElement.tail
      );
    });
  }
};

function parseDocument(source: string) {
  try {
    return parse(source);
  } catch (e) {
    return null;
  }
}

function applyWhitepaceFromOriginalQuery(source: string, printed: string) {
  let firstNonWhitespaceLineNumber: number | null = null;
  const printedLines = printed.split("\n");

  return source
    .split("\n")
    .map((line, idx) => {
      if (line.match(/^\s*$/)) {
        return line;
      }

      if (firstNonWhitespaceLineNumber === null) {
        firstNonWhitespaceLineNumber = idx;
      }

      const leading = getMatch(line, LEADING_WHITESPACE);
      const trailing = getMatch(line, TRAILING_WHITESPACE);

      const printedLine = printedLines[idx - firstNonWhitespaceLineNumber];
      const printedLeading = getMatch(printedLine, LEADING_WHITESPACE);
      const totalWhitespace = leading.length - printedLeading.length;

      return leading.slice(0, totalWhitespace) + printedLine + trailing;
    })
    .join("\n");
}

function addUnmaskDirective(document: DocumentNode, mode: string | undefined) {
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
            arguments:
              mode === "migrate" ?
                [
                  {
                    kind: Kind.ARGUMENT,
                    name: { kind: Kind.NAME, value: "mode" },
                    value: { kind: Kind.STRING, value: "migrate" },
                  },
                ]
              : undefined,
          } satisfies DirectiveNode,
        ],
      };
    },
  });
}

function getMatch(str: string, match: RegExp) {
  return str.match(match)?.at(0) ?? "";
}

function transformGraphQLFile(source: string, mode: string) {
  return print(addUnmaskDirective(parse(source), mode));
}

export default transform;
