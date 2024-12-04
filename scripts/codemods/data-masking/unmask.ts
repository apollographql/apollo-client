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

      const modifiedDocument = addUnmaskDirective(document, mode);

      if (modifiedDocument === document) {
        return templateElement;
      }

      const query = applyIndentationFromOriginalQuery(
        queryString,
        modifiedDocument
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

function applyIndentationFromOriginalQuery(
  source: string,
  document: DocumentNode
) {
  const lines = source.split("\n");
  const locationOffset = document.loc!.source.locationOffset.line;

  const leadingWhitespace = getMatch(source, /^[\s]*(?=\S)/);
  const trailingWhitespace = getMatch(source, TRAILING_WHITESPACE);
  const indentation = getMatch(lines[locationOffset], LEADING_WHITESPACE);

  return (
    leadingWhitespace +
    print(document)
      .split("\n")
      .map((line, idx) => {
        // `leadingWhitespace` will contain the whitespace needed for the
        // first line so we can skip adding it
        return idx === 0 ? line : indentation + line;
      })
      .join("\n") +
    trailingWhitespace
  );
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
