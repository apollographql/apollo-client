/**
 * This build step will inline docblocks specified with `@inheritDoc` on build.
 *
 * E.g. a in a dockblock like this:
 *
 * ```js
 * /** {@inheritDoc @apollo/client!QueryOptions#query:member} *\/
 * ```
 *
 * the annotation (everything from `{` to `}`) will be replaced with the docblock
 * of the `QueryOptions.query` member function.
 *
 * We need this here for situations where inheritance is not possible for `docModel`
 * generation (`interface Foo extends Omit<Bar, 'baz'> {}` is too complicated a
 * type for it to parse) and we want to flatten types - or going forward, for
 * generally flattening types without repeating docs everywhere.
 *
 * You can get these "canonical ids" by running
 *
 * ```sh
 * yarn docmodel
 * ```
 *
 * and looking at the generated [`client.api.json`](../docs/shared/client.api.json) file.
 */
/** End file docs */

// @ts-ignore

import fs, { mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";

import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
} from "@microsoft/api-extractor";
import { ApiDocumentedItem, ApiModel } from "@microsoft/api-extractor-model";
import type { DocComment, DocExcerpt, DocNode } from "@microsoft/tsdoc";
import type { TextRange } from "@microsoft/tsdoc";
import { DeclarationReference } from "@microsoft/tsdoc/lib-commonjs/beta/DeclarationReference.js";
import { visit } from "recast";

import type { BuildStep, BuildStepOptions } from "./build.ts";
import { buildDocEntryPoints } from "./entryPoints.ts";
import {
  applyRecast,
  frameComment,
  patchApiExtractorInternals,
  withPseudoNodeModules,
} from "./helpers.ts";

export const inlineInheritDoc: BuildStep = async (options) => {
  console.log(
    "Processing {@inheritDoc <canonicalReference>} comments in .d.ts files."
  );

  const model = await withPseudoNodeModules(() => loadApiModel(options));
  await processComments(model, options);
};

function getCommentFor(
  canonicalReference: string,
  variables: undefined | Record<string, string>,
  model: ApiModel
) {
  const apiItem = model.resolveDeclarationReference(
    DeclarationReference.parse(canonicalReference),
    undefined
  ).resolvedApiItem;
  if (!apiItem)
    throw new Error(
      `Could not resolve canonical reference "${canonicalReference}"`
    );
  if (apiItem instanceof ApiDocumentedItem) {
    if (!apiItem.tsdocComment) return "";
    const unusedVariables = new Set(Object.keys(variables || {}));
    let string = renderDocComment(apiItem.tsdocComment);

    string = string.replaceAll(/\\?\{\\?\{(\w+)\\?\}\\?\}/g, (_, variable) => {
      unusedVariables.delete(variable);
      const value = variables?.[variable];
      if (value === undefined) {
        throw new Error(
          `Variable "${variable}" is required but not defined for @inheritDoc "${canonicalReference}"`
        );
      }
      return value;
    });
    if (unusedVariables.size > 0) {
      throw new Error(
        `Variables ${[...unusedVariables].join(
          ", "
        )} are defined but not used in @inheritDoc "${canonicalReference}"`
      );
    }
    return string;
  } else {
    throw new Error(
      `"${canonicalReference}" is not documented, so no documentation can be inherited.`
    );
  }
}

function loadApiModel(options: BuildStepOptions) {
  const tempDir = fs.mkdtempSync("api-model");
  try {
    const entryPointFile = path.join(tempDir, "entry.d.ts");
    fs.writeFileSync(entryPointFile, buildDocEntryPoints(options));
    mkdirSync(path.join(tempDir, "node_modules", "@apollo"), {
      recursive: true,
    });
    symlinkSync(
      options.packageRoot,
      path.join(tempDir, "node_modules", "@apollo", "client")
    );

    // Load and parse the api-extractor.json file
    const configObjectFullPath = path.resolve(
      import.meta.dirname,
      "../api-extractor.json"
    );
    const packageJsonFullPath = path.resolve(
      import.meta.dirname,
      "../package.json"
    );
    const tempModelFile = path.join(tempDir, "client.api.json");

    const configObject = ExtractorConfig.loadFile(configObjectFullPath);
    configObject.mainEntryPointFilePath = entryPointFile;
    configObject.docModel = {
      ...configObject.docModel,
      enabled: true,
      apiJsonFilePath: tempModelFile,
    };
    configObject.apiReport = {
      enabled: false,
      reportFileName: "disabled.md",
      reportFolder: tempDir,
    };

    configObject.messages = {
      extractorMessageReporting: {
        default: {
          logLevel: ExtractorLogLevel.None,
        },
      },
      compilerMessageReporting: {
        default: {
          logLevel: ExtractorLogLevel.None,
        },
      },
      tsdocMessageReporting: {
        default: {
          logLevel: ExtractorLogLevel.None,
        },
      },
    };
    const extractorConfig = ExtractorConfig.prepare({
      configObject,
      packageJsonFullPath,
      configObjectFullPath,
    });

    const restore = patchApiExtractorInternals();
    Extractor.invoke(extractorConfig);
    restore();

    const model = new ApiModel();
    model.loadPackage(tempModelFile);
    return model;
  } finally {
    fs.rmSync(tempDir, { recursive: true });
  }
}

function processComments(model: ApiModel, options: BuildStepOptions) {
  const inheritDocRegex =
    /\{\s*@inheritDoc\s+(\S+)(?:\s+(\{[^}]*\}))?\s*\}(?:\s*$)?/;

  return applyRecast({
    glob: `**/*.{${options.jsExt},d.${options.tsExt}}`,
    cwd: options.targetDir,
    transformStep({ ast, sourceName }) {
      return {
        ast: visit(ast, {
          visitNode(path) {
            this.traverse(path);
            const node = path.node;

            if (!node.comments) {
              return;
            }

            for (const comment of node.comments) {
              if (comment.type === "CommentBlock") {
                let newText = comment.value;
                while (inheritDocRegex.test(newText)) {
                  newText = newText.replace(
                    inheritDocRegex,
                    (_, canonicalReference, variables) => {
                      try {
                        return (
                          getCommentFor(
                            canonicalReference,
                            variables ? JSON.parse(variables) : undefined,
                            model
                          ) || ""
                        );
                      } catch (e) {
                        console.warn("\n\n" + e.message);
                        process.exitCode = 1;
                      }
                    }
                  );
                }
                if (newText.includes("@inheritDoc")) {
                  console.warn(
                    "\n\nFound @inheritDoc after processing, something went wrong.",
                    {
                      sourceName,
                      originalText: comment.value,
                      finalReplacement: newText,
                    }
                  );
                  process.exitCode = 1;
                }
                if (comment.value !== newText) {
                  comment.value = frameComment(newText);
                }
              }
            }
          },
        }),
      };
    },
  });
}

function renderDocComment(node: DocComment): string {
  let commentRange: TextRange | undefined = undefined;
  function iterate(node: undefined | DocNode | readonly DocNode[]) {
    if (!node) return; // no node
    if (commentRange) return; // we already found what we're looking for
    if ("forEach" in node) {
      node.forEach(iterate);
      return;
    }
    if (node.kind === "Excerpt") {
      const excerptNode = node as DocExcerpt;
      commentRange = excerptNode.content.parserContext.commentRange;
    }
    node.getChildNodes().forEach(iterate);
  }
  iterate(node);

  if (!commentRange) {
    return "";
  }

  let text = commentRange.toString();
  return text
    .slice(2, -2)
    .split("\n")
    .map((line) =>
      line
        // remove leading ` *` or ` * `
        .replace(/^\s*\* ?/, "")
        // remove singular trailing spaces, but preserve multiple trailing spaces as those have a meaning in markdown
        .replace(/(?<! ) $/, "")
    )
    .join("\n");
}
