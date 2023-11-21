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
import { Project, ts, printNode, Node } from "ts-morph";
import { ApiModel, ApiDocumentedItem } from "@microsoft/api-extractor-model";
import { DeclarationReference } from "@microsoft/tsdoc/lib-commonjs/beta/DeclarationReference";

import fs from "node:fs";
import path from "node:path";
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
} from "@microsoft/api-extractor";

console.log(
  "Processing {@inheritDoc <canonicalReference>} comments in .d.ts files."
);

const model = loadApiModel();
processComments();

function getCommentFor(canonicalReference: string) {
  const apiItem = model.resolveDeclarationReference(
    DeclarationReference.parse(canonicalReference),
    undefined
  ).resolvedApiItem;
  if (!apiItem)
    throw new Error(
      `Could not resolve canonical reference "${canonicalReference}"`
    );
  if (apiItem instanceof ApiDocumentedItem) {
    return apiItem.tsdocComment?.emitAsTsdoc();
  } else {
    throw new Error(
      `"${canonicalReference}" is not documented, so no documentation can be inherited.`
    );
  }
}

function loadApiModel() {
  const tempDir = fs.mkdtempSync("api-model");
  try {
    // Load and parse the api-extractor.json file
    const configObjectFullPath = path.resolve(
      __dirname,
      "../api-extractor.json"
    );
    const packageJsonFullPath = path.resolve(__dirname, "../package.json");
    const tempModelFile = path.join(tempDir, "client.api.json");

    const configObject = ExtractorConfig.loadFile(configObjectFullPath);
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

function processComments() {
  const inheritDocRegex = /\{@inheritDoc ([^}]+)\}/;

  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFiles = project.addSourceFilesAtPaths("dist/**/*.d.ts");
  for (const file of sourceFiles) {
    file.forEachDescendant((node) => {
      if (Node.isPropertySignature(node)) {
        const docsNode = node.getJsDocs()[0];
        if (!docsNode) return;
        const oldText = docsNode.getInnerText();
        const newText = oldText.replace(
          inheritDocRegex,
          (_, canonicalReference) => {
            return getCommentFor(canonicalReference) || "";
          }
        );
        if (oldText !== newText) {
          docsNode.replaceWithText(newText);
        }
      }
    });
    file.saveSync();
  }
}
