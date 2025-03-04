import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree as AST } from "@typescript-eslint/types";

import pkgJson from "../package.json" with { type: "json" };
import { dirname, resolve, sep } from "node:path";

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
    return {
      ImportDeclaration(node) {
        if (!node.source.value.startsWith(".")) {
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
      },
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

export const importFromInsideOtherExport = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
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
    schema: [],
  },
  defaultOptions: [],
});
