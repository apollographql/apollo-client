import type { CodegenConfig } from "@graphql-codegen/cli";

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
        "@apollo/client-graphql-codegen/local-state",
      ],
      config: {
        nonOptionalTypename: true,
        contextType: "./context-value.js#ContextValue",
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
          "@apollo/client-graphql-codegen/local-state",
        ],
        config: {
          nonOptionalTypename: true,
          baseTypesPath: "./base-types.js",
        },
      },
  },
};

export default config;
