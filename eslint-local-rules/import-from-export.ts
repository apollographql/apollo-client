import { dirname, join, relative, resolve, sep } from "node:path";

import type { TSESTree as AST } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";
import { $ } from "zx";

import pkgJson from "../package.json" with { type: "json" };

const entryPoints = Object.fromEntries(
  Object.entries(pkgJson.exports).flatMap(function map(
    this: any,
    [key, value]
  ) {
    const path = `@apollo/client/${key.substring(2)}`.replace(/\/$/, "");
    if (typeof value === "string") {
      return [
        [
          resolve(import.meta.dirname, "..", value).replace(/\.ts$/, ".js"),
          path,
        ],
      ];
    }
    return Object.values(value).flatMap((v) => map([key, v]));
  })
);

const entryPointFolders = Object.keys(entryPoints)
  .map(dirname)
  .filter(function unique(value, index, array) {
    return array.indexOf(value) === index;
  });

function findNearestEntryPointFolder(filename: string) {
  let match: string | undefined = undefined;
  let lookFor = dirname(filename);
  while (!match && lookFor.indexOf(sep) != -1) {
    match = entryPointFolders.find((folder) => folder == lookFor);
    lookFor = lookFor.split(sep).slice(0, -1).join(sep);
  }
  return match;
}

export const importFromExport = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    function rule(node: AST.ImportDeclaration | AST.ExportNamedDeclaration) {
      if (!node.source || !node.source.value.startsWith(".")) {
        return;
      }
      const resolvedTarget = resolve(
        dirname(context.physicalFilename),
        node.source.value
      );
      if (resolvedTarget in entryPoints) {
        context.report({
          node: node.source,
          messageId: "importFromExport",
          fix(fixer) {
            return fixer.replaceTextRange(
              node.source.range,
              `"${entryPoints[resolvedTarget]}"`
            );
          },
        });
      }
    }
    return {
      ImportDeclaration: rule,
      // TODO: enable this in a separate PR for easier review
      // ExportNamedDeclaration: rule,
    };
  },
  meta: {
    messages: {
      importFromExport:
        "Don't use relative imports to import from official entrypoints.",
    },
    type: "problem",
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});

export const noDuplicateExports = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    const seenExports = new Map<string, AST.ExportNamedDeclaration>();
    return {
      ExportNamedDeclaration(node) {
        if (!node.source) {
          return;
        }
        const name = node.source.value + ":" + node.exportKind;
        const alreadySeen = seenExports.get(name);
        if (alreadySeen) {
          context.report({
            node: node,
            messageId: "noDuplicateExports",
            *fix(fixer) {
              for (const specifier of node.specifiers) {
                yield fixer.insertTextBefore(
                  alreadySeen.specifiers[0],
                  context.sourceCode.getText(specifier) + ","
                );
              }
              yield fixer.remove(node);
            },
          });
        }
        seenExports.set(name, node);
      },
    };
  },
  meta: {
    messages: {
      noDuplicateExports:
        "Don't use multiple exports statements with the same source.",
    },
    schema: [],
    type: "problem",
    fixable: "code",
  },
  defaultOptions: [],
});

export const importFromInsideOtherExport = ESLintUtils.RuleCreator.withoutDocs({
  create(context, options) {
    const currentFileEntrypoint = findNearestEntryPointFolder(
      context.physicalFilename
    );
    return {
      ImportDeclaration(node) {
        if (!node.source.value.startsWith(".")) {
          return;
        }
        const resolvedTarget = resolve(
          dirname(context.physicalFilename),
          node.source.value
        );
        if (context.options[0].ignoreFrom.includes(resolvedTarget)) {
          return;
        }
        const importEntrypoint = findNearestEntryPointFolder(resolvedTarget);
        if (currentFileEntrypoint !== importEntrypoint) {
          context.report({
            node: node.source,
            messageId: "importFromInsideOtherExport",
          });
        }
      },
    };
  },
  meta: {
    messages: {
      importFromInsideOtherExport:
        "Don't use relative imports to import from internals outside the same entry point.",
    },
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          ignoreFrom: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    ],
  },
  defaultOptions: [
    {
      ignoreFrom: [],
    },
  ],
});

const knownPublicExports: Record<string, string[]> = {};
function getPublicExports(path: string) {
  if (!(path in knownPublicExports)) {
    const result = $.sync({
      cwd: resolve(import.meta.dirname, "../dist"),
    })`node --input-type=module --eval 'console.log(JSON.stringify(Object.keys(await import("${path}")).sort()))'`;
    knownPublicExports[path] = JSON.parse(result.text()) as string[];
  }
  return knownPublicExports[path];
}

/**
 * to be used in tests, so the test does a
 * `import { InMemoryCache } from "@apollo/client/core";`
 * instead of a
 * `import { InMemoryCache } from "../inMemoryCache.js";`
 */
export const noInternalImportOfficialExport =
  ESLintUtils.RuleCreator.withoutDocs({
    create(context, options) {
      return {
        ImportDeclaration(node) {
          if (!node.source.value.startsWith(".")) {
            return;
          }
          const resolvedTarget = resolve(
            dirname(context.physicalFilename),
            node.source.value
          );
          if (resolvedTarget.includes("__tests__")) {
            return;
          }
          const entry = findNearestEntryPointFolder(resolvedTarget);
          if (!entry || entry.includes("testing")) {
            return;
          }
          const importEntrypoint = join(
            "@apollo/client",
            relative(join(import.meta.dirname, "..", "src"), entry)
          );
          const knownExports = getPublicExports(importEntrypoint);

          for (const specifier of node.specifiers) {
            if (specifier.type == "ImportSpecifier") {
              const name =
                specifier.imported.type === "Identifier" ?
                  specifier.imported.name
                : specifier.imported.value;
              const couldBeImportedFromPublicExport =
                knownExports.includes(name);

              if (couldBeImportedFromPublicExport) {
                context.report({
                  node: node.source,
                  messageId: "noInternalImportOfficialExport",
                  *fix(fixer) {
                    yield fixer.insertTextBefore(
                      node,
                      `import { ${name} } from "${importEntrypoint}";\n`
                    );
                    // duplicates will be fixed by imports/no-duplicates

                    if (node.specifiers.length === 1) {
                      yield fixer.remove(node);
                    } else {
                      yield fixer.remove(specifier);
                      const comma = context.sourceCode.getTokenAfter(specifier);
                      if (comma.value === ",") {
                        yield fixer.remove(comma);
                      }
                    }
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
        noInternalImportOfficialExport:
          "This should be imported from the official entry point, not from the internal file.",
      },
      type: "problem",
      schema: [],
      fixable: "code",
    },
    defaultOptions: [],
  });
