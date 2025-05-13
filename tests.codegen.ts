import type { CodegenConfig } from "@graphql-codegen/cli";

// @ts-ignore for some reason this allows codegen to load the plugin, otherwise it errors
await import("@apollo/client/local-state/codegen");

const config: CodegenConfig = {
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
  generates: {
    "./src/local-state/__tests__/LocalState/fixtures/local-resolvers.ts": {
      schema: [
        "./src/local-state/__tests__/LocalState/fixtures/localSchema.graphql",
      ],
      plugins: [
        { add: { content: "/* eslint-disable */" } },
        "typescript",
        "@apollo/client/local-state/codegen",
      ],
      config: {
        nonOptionalTypename: true,
        rootValueType: "./rootValue.js#RootValue",
        baseTypesPath: "./base-types.js",
      },
    },
    "./src/local-state/__tests__/LocalState/fixtures/local-resolvers-without-context-value.ts":
      {
        schema: [
          "./src/local-state/__tests__/LocalState/fixtures/localSchema.graphql",
        ],
        plugins: [
          { add: { content: "/* eslint-disable */" } },
          "typescript",
          "@apollo/client/local-state/codegen",
        ],
        config: {
          nonOptionalTypename: true,
          baseTypesPath: "./base-types.js",
        },
      },
  },
};

export default config;
