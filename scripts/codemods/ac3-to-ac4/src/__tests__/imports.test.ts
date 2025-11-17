import { applyTransform } from "jscodeshift/dist/testUtils";
import { describe, expect, test } from "vitest";

import imports from "../imports.js";

const transform = ([source]: TemplateStringsArray) =>
  applyTransform(imports, {}, { source }, { parser: "ts" });

describe("aliases if `legacyEntryPoints` transform was not applied", () => {
  test('moves into existing compatible "legacy" entry point', () => {
    expect(
      transform`
    import { useQuery } from "@apollo/client/index.js";
    import { somethingElse } from "@apollo/client/react/react.cjs";
    `
    ).toMatchInlineSnapshot(
      `"import { somethingElse, useQuery } from "@apollo/client/react/react.cjs";"`
    );
  });
  test("if nonexistent, creates new modern entry points", () => {
    expect(
      transform`
    import { useQuery } from "@apollo/client/index.js";
    `
    ).toMatchInlineSnapshot(
      `"import { useQuery } from "@apollo/client/react";"`
    );
  });
});
