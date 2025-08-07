import { createPatch } from "diff";
import type { Transform } from "jscodeshift";
import { applyTransform } from "jscodeshift/dist/testUtils.js";

export const createDiff = (transform: Transform) => (source: string) => {
  const transformed = applyTransform(
    transform,
    {},
    { source },
    { parser: "ts" }
  );
  const patch = createPatch(
    "test.ts",
    source,
    transformed || source,
    "original",
    "transformed"
  );
  return patch.replace(/@@ -\d+,\d+ \+\d+,\d+ @@/g, "@@  @@");
};
