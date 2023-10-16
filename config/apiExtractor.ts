import * as path from "path";
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
  ExtractorResult,
} from "@microsoft/api-extractor";
// @ts-ignore
import { map } from "./entryPoints.js";

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
          path ? "-" + path.replace("/", "_") : ""
        }.md`,
      },
      messages: {
        ...baseConfig.messages,
        extractorMessageReporting: {
          ...baseConfig.messages?.extractorMessageReporting,
          // partial bundles will give error messages like
          // The package "@apollo/client" does not have an export "ApolloLink"
          // so we disable this rule for them
          "ae-unresolved-link": {
            logLevel:
              entryPoint.dirs.length === 0
                ? ExtractorLogLevel.Warning
                : ExtractorLogLevel.None,
            addToApiReportFile: true,
          },
        },
      },
    },
    packageJsonFullPath,
    configObjectFullPath,
  });

  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    localBuild: process.env.CI === undefined,
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
