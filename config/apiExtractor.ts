import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { format, join, parse } from "node:path";
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
  "../package.json"
);
const reportFolder = baseConfig.apiReport.reportFolder!.replace(
  "<projectFolder>",
  join(import.meta.dirname, "..")
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

    const result = await buildReport(
      "@apollo/client",
      entryPointFile,
      "docModel"
    );
    if (process.exitCode === 50) {
      process.exitCode = 0; // if there were only warnings, we still want to exit with 0
    }

    console.log("Creating file with all possible canonical references...");
    const canonicalReferences = new Set<string>();
    const file = await readFile(result.extractorConfig.apiJsonFilePath, "utf8");
    JSON.parse(file, (key, value) => {
      if (
        key === "canonicalReference" &&
        typeof value === "string" &&
        value.startsWith("@apollo/client")
      ) {
        canonicalReferences.add(value);
      }
      return undefined;
    });
    await writeFile(
      format({
        ...parse(result.extractorConfig.apiJsonFilePath),
        base: "canonical-references.json",
      }),
      JSON.stringify([...canonicalReferences.values()], null, 2),
      "utf8"
    );
  }

  if (parsed.values.generate?.includes("apiReport")) {
    for (const entryPoint of entryPoints) {
      let entry = entryPoint.value;
      while (typeof entry === "object") {
        entry = entry.types || Object.values(entry).at(-1);
      }
      const mainEntryPointFilePath = `<projectFolder>/dist/${entry}`
        .replace("//", "/")
        .replace(/\.cjs$/, ".d.cts")
        .replace(/\.js$/, ".d.ts");
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
    process.exitCode = extractorResult.errorCount === 0 ? 50 : 1;
    console.error(
      `❗ API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    );
    if (extractorResult.apiReportChanged) {
      spawnSync(
        "diff",
        [
          join(reportFolder, reportFileName),
          join(reportFolder, "temp", reportFileName),
        ],
        {
          stdio: "inherit",
        }
      );
    }
  }
  return extractorResult;
}
