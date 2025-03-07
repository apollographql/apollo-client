/**
 * This CLI tool will inline docblocks specified with `@inheritDoc` on build.
 *
 *
 * E.g. a in a dockblock like this:
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
 * ```sh
 * yarn docmodel
 * ```
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
import { StringBuilder, TSDocEmitter } from "@microsoft/tsdoc";
import { DeclarationReference } from "@microsoft/tsdoc/lib-commonjs/beta/DeclarationReference.js";
import { visit } from "recast";

import type { BuildStep, BuildStepOptions } from "./build.ts";
import { buildDocEntryPoints } from "./entryPoints.ts";
import { applyRecast, withPseudoNodeModules } from "./helpers.ts";

export const inlineInheritDoc: BuildStep = async (options) => {
  console.log(
    "Processing {@inheritDoc <canonicalReference>} comments in .d.ts files."
  );

  const model = await withPseudoNodeModules(() => loadApiModel(options));
  await processComments(model, options);
};

function getCommentFor(canonicalReference: string, model: ApiModel) {
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
    const stringBuilder = new StringBuilder();
    const emitter = new TSDocEmitter();
    emitter["_emitCommentFraming"] = false;
    emitter["_renderCompleteObject"](stringBuilder, apiItem.tsdocComment);
    return stringBuilder.toString();
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

    Extractor.invoke(extractorConfig);

    const model = new ApiModel();
    model.loadPackage(tempModelFile);
    return model;
  } finally {
    fs.rmSync(tempDir, { recursive: true });
  }
}

function processComments(model: ApiModel, options: BuildStepOptions) {
  const inheritDocRegex = /\{@inheritDoc ([^}]+)\}/;

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
                    (_, canonicalReference) => {
                      return getCommentFor(canonicalReference, model) || "";
                    }
                  );
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

function frameComment(text: string) {
  const framed = text
    .split("\n")
    .map((t) => t.trim())
    .map((t) => (!t.startsWith("*") ? "* " + t : t))
    .join("\n")
    .replaceAll(/(^(\s*\*\s*\n)*|(\n\s*\*\s*)*$)/g, "");
  return `*\n${framed}\n`;
}
