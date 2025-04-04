import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import * as path from "path";

import type { IConfigFile } from "@microsoft/api-extractor";
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
} from "@microsoft/api-extractor";

import pkg from "../dist/package.json" with { type: "json" };

import type { ExportsCondition } from "./entryPoints.ts";
import { buildDocEntryPoints } from "./entryPoints.ts";
import { withPseudoNodeModules } from "./helpers.ts";

const parsed = parseArgs({
  options: {
    generate: {
      type: "string",
      multiple: true,
      default: ["apiReport"],
    },
    "main-only": {
      type: "boolean",
      default: false,
    },
  },
});

if (
  !parsed.values.generate!.every((v) => ["apiReport", "docModel"].includes(v))
) {
  throw new Error(
    "invalid value for --generate. Only allowed values are `apiReport` and `docModel`!"
  );
}

// Load and parse the api-extractor.json file
const configObjectFullPath = path.resolve(
  import.meta.dirname,
  "../api-extractor.json"
);
const baseConfig = ExtractorConfig.loadFile(configObjectFullPath);
const packageJsonFullPath = path.resolve(
  import.meta.dirname,
  "../dist/package.json"
);

const entryPoints = Object.entries(pkg.exports as ExportsCondition)
  .filter(([key]) => !(key.includes("*") || key.includes(".json")))
  .map(([key, value]) => {
    return {
      path: key.slice("./".length),
      key,
      value,
    };
  });

process.exitCode = 0;

const tempDir = fs.mkdtempSync(
  path.join(import.meta.dirname, "..", "dist", "api-model")
);
try {
  if (parsed.values.generate?.includes("docModel")) {
    console.log(
      "\n\nCreating API extractor docmodel for the a combination of all entry points"
    );
    const entryPointFile = path.join(tempDir, "entry.d.ts");
    fs.writeFileSync(
      entryPointFile,
      buildDocEntryPoints({
        rootDir: path.resolve(import.meta.dirname, ".."),
        targetDir: "dist",
        jsExt: "js",
      })
    );

    await buildReport("@apollo/client", entryPointFile, "docModel");
  }

  if (parsed.values.generate?.includes("apiReport")) {
    for (const entryPoint of entryPoints) {
      let entry = entryPoint.value;
      while (typeof entry === "object") {
        entry = entry.types || Object.values(entry).at(-1);
      }
      const mainEntryPointFilePath = `<projectFolder>/dist/${entry}`.replace(
        "//",
        "/"
      );
      console.log(
        "\n\nCreating API extractor report for " + mainEntryPointFilePath
      );
      const reportFileName = `api-report${
        entryPoint.path ? "-" + entryPoint.path.replace(/\//g, "_") : ""
      }.api.md`;
      await buildReport(
        join("@apollo/client", entryPoint.key),
        mainEntryPointFilePath,
        "apiReport",
        reportFileName
      );

      await cleanupApiReport(
        join(
          baseConfig.apiReport.reportFolder!.replace(
            "<projectFolder>",
            join(import.meta.dirname, "..")
          ),
          reportFileName
        ),
        join(import.meta.dirname, "..", "src")
      );
    }
  }
} finally {
  fs.rmSync(tempDir, { recursive: true });
}

async function buildReport(
  bundledPackages: string | string[],
  mainEntryPointFilePath: string,
  mode: "apiReport" | "docModel",
  reportFileName = ""
) {
  if (!Array.isArray(bundledPackages)) {
    bundledPackages = [bundledPackages];
  }
  const configObject: IConfigFile = {
    ...(JSON.parse(JSON.stringify(baseConfig)) as IConfigFile),
    mainEntryPointFilePath,
  };
  configObject.bundledPackages = bundledPackages;

  if (mode === "apiReport") {
    configObject.apiReport!.enabled = true;
    configObject.docModel = { enabled: false };
    configObject.messages!.extractorMessageReporting![
      "ae-unresolved-link"
    ]!.logLevel = ExtractorLogLevel.None;
    configObject.apiReport!.reportFileName = reportFileName;
  } else {
    configObject.docModel!.enabled = true;
    configObject.apiReport = {
      enabled: false,
      // this has to point to an existing folder, otherwise the extractor will fail
      // but it will not write the file
      reportFileName: "disabled.md",
      reportFolder: tempDir,
    };
  }

  const extractorConfig = ExtractorConfig.prepare({
    configObject,
    packageJsonFullPath,
    configObjectFullPath,
  });

  const extractorResult = await withPseudoNodeModules(() =>
    Extractor.invoke(extractorConfig, {
      localBuild: process.env.CI === undefined || process.env.CI === "false",
      showVerboseMessages: true,
    })
  );

  if (extractorResult.succeeded) {
    console.log(`✅ API Extractor completed successfully`);
  } else {
    console.error(
      `❗ API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    );
    process.exitCode = 1;
  }
}

/**
 * Cleans up the "Warnings were encountered during analysis:" section of the api report in two steps:
 *
 * original:
 * // /Users/tronic/tmp/apollo-client/src/cache/core/types/DataProxy.ts:137:9 - (ae-forgotten-export) The symbol "DeepPartial" needs to be exported by the entry point index.d.ts
 * step 1: remove path
 * // src/cache/core/types/DataProxy.ts:137:9 - (ae-forgotten-export) The symbol "DeepPartial" needs to be exported by the entry point index.d.ts
 * step 2: remove line number
 * // src/cache/core/types/DataProxy.ts - (ae-forgotten-export) The symbol "DeepPartial" needs to be exported by the entry point index.d.ts
 */
async function cleanupApiReport(reportFileName: string, sourcePath: string) {
  const contents = await readFile(reportFileName, { encoding: "utf-8" });
  const newContents = contents
    .split("\n")
    .map((line) => line.replace(sourcePath, "src"))
    .map((line) => line.replace(/:\d+:\d+ - \(/, " - ("))
    .join("\n");
  await writeFile(reportFileName, newContents, { encoding: "utf-8" });
}
