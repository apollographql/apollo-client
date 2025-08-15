import { describe, expect, test } from "vitest";

import removals from "../removals.js";

import { createDiff } from "./diffTransform.js";
import allExports from "./exports.json" with { type: "json" };
const diff = createDiff(removals);

test("all exports", () => {
  const source = Object.entries(allExports)
    .map(([entryPoint, exports]) =>
      `
import {
  ${exports
    .map(
      (info) =>
        `${info.name} as ${entryPoint
          .replace(/@apollo\/client\/?/, "")
          .replace(/[/-]/g, "_")}_${info.name}`
    )
    .join(",\n  ")},
} from "${entryPoint}";
            `.trim()
    )
    .join("\n\n");

  //console.log(source);

  expect(diff(source)).toMatchSnapshot();
});
