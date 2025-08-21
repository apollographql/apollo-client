import { applyTransform } from "jscodeshift/dist/testUtils";
import { expect, test } from "vitest";

import legacyEntrypointTransform from "../legacyEntrypoints.js";

const transform = ([source]: TemplateStringsArray) =>
  applyTransform(legacyEntrypointTransform, {}, { source }, { parser: "ts" });

test("renames", () => {
  expect(
    transform`import { something } from "@apollo/client/apollo-client.cjs";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/apollo-client.min.cjs";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/index.js";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/main.cjs";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/main.cjs.native.js";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/core/index.js";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client";"`);

  expect(
    transform`import { something } from "@apollo/client/link/core/index.js";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client/link";"`);

  expect(
    transform`import { something } from "@apollo/client/link/core/core.cjs";`
  ).toMatchInlineSnapshot(`"import { something } from "@apollo/client/link";"`);
});

test("merge into existing import", () => {
  expect(
    transform`
    import { something } from "@apollo/client/core/index.js";
    import { somethingElse } from "@apollo/client";
    `
  ).toMatchInlineSnapshot(
    `"import { somethingElse, something } from "@apollo/client";"`
  );
});

test("avoids merging type/value", () => {
  expect(
    transform`
    import type { something } from "@apollo/client/core/index.js";
    import { somethingElse } from "@apollo/client";
    `
  ).toMatchInlineSnapshot(
    `
    "import type { something } from "@apollo/client";
        import { somethingElse } from "@apollo/client";"
  `
  );

  expect(
    transform`
    import  { something } from "@apollo/client/core/index.js";
    import type { somethingElse } from "@apollo/client";
    `
  ).toMatchInlineSnapshot(
    `
    "import { something } from "@apollo/client";
        import type { somethingElse } from "@apollo/client";"
  `
  );
});
