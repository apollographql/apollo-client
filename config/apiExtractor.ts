import * as path from "path";
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
  IConfigFile,
} from "@microsoft/api-extractor";
import { parseArgs } from "node:util";
import fs from "node:fs";

// @ts-ignore
import { map, buildDocEntryPoints } from "./entryPoints.js";
import { readFileSync } from "fs";

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
const configObjectFullPath = path.resolve(__dirname, "../api-extractor.json");
const baseConfig = ExtractorConfig.loadFile(configObjectFullPath);
const packageJsonFullPath = path.resolve(__dirname, "../package.json");

process.exitCode = 0;

const tempDir = fs.mkdtempSync("api-model");
try {
  if (parsed.values.generate?.includes("docModel")) {
    console.log(
      "\n\nCreating API extractor docmodel for the a combination of all entry points"
    );
    const entryPointFile = path.join(tempDir, "entry.d.ts");
    fs.writeFileSync(entryPointFile, buildDocEntryPoints());

    buildReport(entryPointFile, "docModel");
  }

  if (parsed.values.generate?.includes("apiReport")) {
    map((entryPoint: { dirs: string[] }) => {
      const path = entryPoint.dirs.join("/");
      const mainEntryPointFilePath =
        `<projectFolder>/dist/${path}/index.d.ts`.replace("//", "/");
      console.log(
        "\n\nCreating API extractor report for " + mainEntryPointFilePath
      );
      buildReport(
        mainEntryPointFilePath,
        "apiReport",
        `api-report${path ? "-" + path.replace(/\//g, "_") : ""}.api.md`
      );
    });
  }
} finally {
  fs.rmSync(tempDir, { recursive: true });
}

function buildReport(
  mainEntryPointFilePath: string,
  mode: "apiReport" | "docModel",
  reportFileName = ""
) {
  const configObject: IConfigFile = {
    ...(JSON.parse(JSON.stringify(baseConfig)) as IConfigFile),
    mainEntryPointFilePath,
  };

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

  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: process.env.CI === undefined || process.env.CI === "false",
    showVerboseMessages: true,
  });

  let succeededAdditionalChecks = true;
  if (fs.existsSync(extractorConfig.reportFilePath)) {
    const contents = readFileSync(extractorConfig.reportFilePath, "utf8");
    if (contents.includes("rehackt")) {
      succeededAdditionalChecks = false;
      console.error(
        "❗ %s contains a reference to the `rehackt` package!",
        extractorConfig.reportFilePath
      );
    }
    if (contents.includes('/// <reference types="react" />')) {
      succeededAdditionalChecks = false;
      console.error(
        "❗ %s contains a reference to the global `React` type!/n" +
          'Use `import type * as ReactTypes from "react";` instead',
        extractorConfig.reportFilePath
      );
    }
  }

  if (extractorResult.succeeded && succeededAdditionalChecks) {
    console.log(`✅ API Extractor completed successfully`);
  } else {
    console.error(
      `❗ API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    );
    if (!succeededAdditionalChecks) {
      console.error("Additional checks failed.");
    }
    process.exitCode = 1;
  }
}
