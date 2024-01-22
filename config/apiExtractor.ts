import * as path from "path";
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
  IConfigFile,
} from "@microsoft/api-extractor";
import { parseArgs } from "node:util";

// @ts-ignore
import { map } from "./entryPoints.js";

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

map((entryPoint: { dirs: string[] }) => {
  if (entryPoint.dirs.length > 0 && parsed.values["main-only"]) return;

  const path = entryPoint.dirs.join("/");
  const mainEntryPointFilePath =
    `<projectFolder>/dist/${path}/index.d.ts`.replace("//", "/");
  console.log(
    "\n\nCreating API extractor report for " + mainEntryPointFilePath
  );

  const configObject: IConfigFile = {
    ...(JSON.parse(JSON.stringify(baseConfig)) as IConfigFile),
    mainEntryPointFilePath,
  };

  configObject.apiReport!.reportFileName = `api-report${
    path ? "-" + path.replace("/", "_") : ""
  }.md`;

  configObject.apiReport!.enabled =
    parsed.values.generate?.includes("apiReport") || false;

  configObject.docModel!.enabled =
    parsed.values.generate?.includes("docModel") || false;

  if (entryPoint.dirs.length !== 0) {
    configObject.docModel = { enabled: false };
    configObject.tsdocMetadata = { enabled: false };
    configObject.messages!.extractorMessageReporting![
      "ae-unresolved-link"
    ]!.logLevel = ExtractorLogLevel.None;
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

  if (extractorResult.succeeded) {
    console.log(`✅ API Extractor completed successfully`);
  } else {
    console.error(
      `❗ API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`
    );
    process.exitCode = 1;
  }
});
