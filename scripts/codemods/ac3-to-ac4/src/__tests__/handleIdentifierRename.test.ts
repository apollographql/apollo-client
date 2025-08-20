import type { Options } from "jscodeshift";
import { applyTransform } from "jscodeshift/dist/testUtils";
import { describe, expect, test } from "vitest";

import type { IdentifierRename } from "../renames.js";
import { handleIdentiferRename } from "../util/handleIdentiferRename.js";

declare module "jscodeshift/dist/testUtils" {
  export function applyTransform(
    module: import("jscodeshift").Transform,
    options: Options,
    input: { source: string; path?: string },
    testOptions?: Record<string, unknown>
  ): string;
}

const transform = (
  source: string,
  options: IdentifierRename | IdentifierRename[]
) => {
  const lines = source.split("\n");
  const minIndent = lines.reduce((min, line) => {
    if (line.match(/^\s*$/)) return min; // skip empty lines
    return Math.min(min, line.search(/\S|$/));
  }, Infinity);
  if (minIndent > 0) {
    source = lines.map((line) => line.slice(minIndent)).join("\n");
  }

  return applyTransform(
    (file, api, options) => {
      const j = api.jscodeshift;
      const source = j(file.source);
      const context = { j, source };
      let modified = false;
      if (!Array.isArray(options)) {
        options = [options];
      }
      for (const rename of options as IdentifierRename[]) {
        handleIdentiferRename({
          context,
          rename,
          onModify() {
            modified = true;
          },
        });
      }
      if (modified) return source.toSource();
    },
    options,
    { source },
    { parser: "ts" }
  );
};

test("moving identifier from one module to another", () => {
  expect(
    transform("import { useQuery } from '@apollo/client'", {
      from: { module: "@apollo/client", identifier: "useQuery" },
      to: { module: "@apollo/client/react" },
      importType: "value",
    })
  ).toMatchInlineSnapshot(`
    "import { useQuery } from "@apollo/client/react";"
  `);
});

test("renaming identifier inside module", () => {
  expect(
    transform(
      `
      import { useQuery } from '@apollo/client'
      useQuery({ query: MY_QUERY });
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: { identifier: "useRenamedQuery" },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { useRenamedQuery } from '@apollo/client'
    useRenamedQuery({ query: MY_QUERY });"
  `);
});

test("moving identifier onto namespace inside module", () => {
  expect(
    transform(
      `
      import { useQuery } from '@apollo/client'
      useQuery({ query: MY_QUERY });
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: { namespace: "surpriseNamespace", identifier: "useRenamedQuery" },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { surpriseNamespace } from '@apollo/client'
    surpriseNamespace.useRenamedQuery({ query: MY_QUERY });"
  `);
});

test("renaming identifier to different module", () => {
  expect(
    transform(
      `
      import { useQuery } from '@apollo/client'
      useQuery({ query: MY_QUERY });
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: { module: "@apollo/client/react", identifier: "useRenamedQuery" },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { useRenamedQuery } from "@apollo/client/react";
    useRenamedQuery({ query: MY_QUERY });"
  `);
});

test("moving identifier into namespace in different module", () => {
  expect(
    transform(
      `
      import { useQuery } from '@apollo/client'
      useQuery({ query: MY_QUERY });
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: {
          module: "@apollo/client/react",
          identifier: "useRenamedQuery",
          namespace: "surpriseNamespace",
        },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { surpriseNamespace } from "@apollo/client/react";
    surpriseNamespace.useRenamedQuery({ query: MY_QUERY });"
  `);
});

test("type import moves into type import if available (1)", () => {
  expect(
    transform(
      `
      import type { QueryOptions } from '@apollo/client'
      import { unrelated } from '@apollo/client/react'
      import type { UnrelatedType } from '@apollo/client/react'
      `,
      {
        from: { module: "@apollo/client", identifier: "QueryOptions" },
        to: {
          module: "@apollo/client/react",
        },
        importType: "type",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { unrelated } from '@apollo/client/react'
    import type { UnrelatedType, QueryOptions } from '@apollo/client/react';"
  `);
});

test("type import moves into type import if available (2)", () => {
  expect(
    transform(
      `
      import type { QueryOptions } from '@apollo/client'
      import type { UnrelatedType } from '@apollo/client/react'
      import { unrelated } from '@apollo/client/react'
      `,
      {
        from: { module: "@apollo/client", identifier: "QueryOptions" },
        to: {
          module: "@apollo/client/react",
        },
        importType: "type",
      }
    )
  ).toMatchInlineSnapshot(`
    "import type { UnrelatedType, QueryOptions } from '@apollo/client/react';
    import { unrelated } from '@apollo/client/react'"
  `);
});

test("type import moves into value import if no type import available", () => {
  expect(
    transform(
      `
      import type { QueryOptions } from '@apollo/client'
      import { unrelated } from '@apollo/client/react'
      `,
      {
        from: { module: "@apollo/client", identifier: "QueryOptions" },
        to: {
          module: "@apollo/client/react",
        },
        importType: "type",
      }
    )
  ).toMatchInlineSnapshot(
    `"import { unrelated, QueryOptions } from '@apollo/client/react';"`
  );
});

test("value import moves into value import if available (1)", () => {
  expect(
    transform(
      `
      import type { useQuery } from '@apollo/client'
      import type { UnrelatedType } from '@apollo/client/react'
      import { unrelated } from '@apollo/client/react'
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: {
          module: "@apollo/client/react",
        },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import type { UnrelatedType } from '@apollo/client/react'
    import { unrelated, useQuery } from '@apollo/client/react';"
  `);
});

test("value import moves into value import if available (2)", () => {
  expect(
    transform(
      `
      import type { useQuery } from '@apollo/client'
      import { unrelated } from '@apollo/client/react'
      import type { UnrelatedType } from '@apollo/client/react'
      `,
      {
        from: { module: "@apollo/client", identifier: "useQuery" },
        to: {
          module: "@apollo/client/react",
        },
        importType: "value",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { unrelated, useQuery } from '@apollo/client/react';
    import type { UnrelatedType } from '@apollo/client/react'"
  `);
});

describe("aliased imports", () => {
  test("moving identifier from one module to another", () => {
    expect(
      transform(
        `
        import { useQuery as useAliasedQuery } from '@apollo/client'
        useAliasedQuery({ query: MY_QUERY });
        `,
        {
          from: { module: "@apollo/client", identifier: "useQuery" },
          to: { module: "@apollo/client/react" },
          importType: "value",
        }
      )
    ).toMatchInlineSnapshot(
      `
      "import { useQuery as useAliasedQuery } from "@apollo/client/react";
      useAliasedQuery({ query: MY_QUERY });"
    `
    );
  });

  test("renaming identifier inside module", () => {
    expect(
      transform(
        `
      import { useQuery as useAliasedQuery } from '@apollo/client'
      useAliasedQuery({ query: MY_QUERY });
      `,
        {
          from: { module: "@apollo/client", identifier: "useQuery" },
          to: { identifier: "useRenamedQuery" },
          importType: "value",
        }
      )
    ).toMatchInlineSnapshot(`
      "import { useRenamedQuery as useAliasedQuery } from '@apollo/client'
      useAliasedQuery({ query: MY_QUERY });"
    `);
  });

  test("moving identifier onto namespace inside module", () => {
    expect(
      transform(
        `
      import { useQuery as useAliasedQuery } from '@apollo/client'
      useAliasedQuery({ query: MY_QUERY });
      `,
        {
          from: { module: "@apollo/client", identifier: "useQuery" },
          to: { namespace: "surpriseNamespace", identifier: "useRenamedQuery" },
          importType: "value",
        }
      )
    ).toMatchInlineSnapshot(`
      "import { surpriseNamespace } from '@apollo/client'
      surpriseNamespace.useRenamedQuery({ query: MY_QUERY });"
    `);
  });

  test("renaming identifier to different module", () => {
    expect(
      transform(
        `
      import { useQuery as useAliasedQuery } from '@apollo/client'
      useAliasedQuery({ query: MY_QUERY });
      `,
        {
          from: { module: "@apollo/client", identifier: "useQuery" },
          to: { module: "@apollo/client/react", identifier: "useRenamedQuery" },
          importType: "value",
        }
      )
    ).toMatchInlineSnapshot(`
      "import { useRenamedQuery as useAliasedQuery } from "@apollo/client/react";
      useAliasedQuery({ query: MY_QUERY });"
    `);
  });

  test("moving identifier into namespace in different module", () => {
    expect(
      transform(
        `
      import { useQuery as useAliasedQuery } from '@apollo/client'
      useAliasedQuery({ query: MY_QUERY });
      `,
        {
          from: { module: "@apollo/client", identifier: "useQuery" },
          to: {
            module: "@apollo/client/react",
            identifier: "useRenamedQuery",
            namespace: "surpriseNamespace",
          },
          importType: "value",
        }
      )
    ).toMatchInlineSnapshot(`
      "import { surpriseNamespace } from "@apollo/client/react";
      surpriseNamespace.useRenamedQuery({ query: MY_QUERY });"
    `);
  });

  test("target namespace import already exists", () => {
    expect(
      transform(
        `
      import type { ExecutionPatchInitialResult } from "@apollo/client";
      import type { ExecutionPatchIncrementalResult } from "@apollo/client/link"
      type Test = ExecutionPatchInitialResult | ExecutionPatchIncrementalResult;
      `,
        [
          {
            from: {
              module: "@apollo/client/link",
              alternativeModules: ["@apollo/client"],
              identifier: "ExecutionPatchInitialResult",
            },
            to: {
              module: "@apollo/client/incremental",
              namespace: "Defer20220824Handler",
              identifier: "InitialResult",
            },
            importType: "type",
          },
          {
            from: {
              module: "@apollo/client/link",
              alternativeModules: ["@apollo/client"],
              identifier: "ExecutionPatchIncrementalResult",
            },
            to: {
              module: "@apollo/client/incremental",
              namespace: "Defer20220824Handler",
              identifier: "SubsequentResult",
            },
            importType: "type",
          },
        ]
      )
    ).toMatchInlineSnapshot(`
      "import type { Defer20220824Handler } from "@apollo/client";
      type Test = Defer20220824Handler.InitialResult | Defer20220824Handler.SubsequentResult;"
    `);
  });
});

test("generic position", () => {
  expect(
    transform(
      `
        import { FetchResult } from "@apollo/client";
        fn<FetchResult>();
      `,
      {
        from: {
          module: "@apollo/client/link",
          alternativeModules: ["@apollo/client"],
          identifier: "FetchResult",
        },
        to: { namespace: "ApolloLink", identifier: "Result" },
        importType: "type",
      }
    )
  ).toMatchInlineSnapshot(`
    "import { ApolloLink } from "@apollo/client";
    fn<ApolloLink.Result>();"
  `);
});
