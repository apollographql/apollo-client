import { describe, expect, test } from "vitest";

import imports from "../imports.js";

import { createDiff } from "./diffTransform.js";
import allExports from "./exports.json" with { type: "json" };
const diff = createDiff(imports);

describe("individual exports", () => {
  for (const [entryPoint, exports] of Object.entries(allExports)) {
    describe(entryPoint, () => {
      for (const info of exports) {
        test(info.name, () => {
          expect(
            diff(
              `
import { ${info.name} } from "${info.moduleName}";
${info.usageExamples.join("\n")}
            `.trim()
            )
          ).toMatchSnapshot();
        });
      }
    });
  }
});

describe("all exports", () => {
  for (const [entryPoint, exports] of Object.entries(allExports)) {
    test(entryPoint, () => {
      expect(
        diff(
          `
import {
  ${exports.map((info) => info.name).join(",\n  ")}
} from "${entryPoint}";
${exports.map((info) => info.usageExamples.join("\n")).join("\n")}
            `.trim()
        )
      ).toMatchSnapshot();
    });
  }
});
