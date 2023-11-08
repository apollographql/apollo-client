import * as path from "path";
import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from "@microsoft/api-extractor";
// @ts-ignore
import { map } from "./entryPoints.js";
import { readFileSync } from "fs";

// Load and parse the api-extractor.json file
const configObjectFullPath = path.resolve(__dirname, "../api-extractor.json");
const baseConfig = ExtractorConfig.loadFile(configObjectFullPath);
const packageJsonFullPath = path.resolve(__dirname, "../package.json");

process.exitCode = 0;

map((entryPoint: { dirs: string[] }) => {
  const path = entryPoint.dirs.join("/");
  const mainEntryPointFilePath =
    `<projectFolder>/dist/${path}/index.d.ts`.replace("//", "/");
  console.log(
    "\n\nCreating API extractor report for " + mainEntryPointFilePath
  );

  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: {
      ...baseConfig,
      mainEntryPointFilePath,
      apiReport: {
        enabled: true,
        ...baseConfig.apiReport,
        reportFileName: `api-report${
          path ? "-" + path.replace(/\//g, "_") : ""
        }.md`,
      },
    },
    packageJsonFullPath,
    configObjectFullPath,
  });

  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    localBuild: process.env.CI === undefined,
    showVerboseMessages: true,
  });

  let succeededAdditionalChecks = true;
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
});
