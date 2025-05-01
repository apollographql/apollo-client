import type { CodegenConfig } from "@graphql-codegen/cli";

// @ts-ignore for some reason this allows codegen to load the plugin, otherwise it errors
await import("@apollo/client/link/local-resolvers/codegen");

const config: CodegenConfig = {
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
  generates: {
    "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/local-resolvers.ts":
      {
        schema: [
          "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/localSchema.graphql",
        ],
        plugins: [
          { add: { content: "/* eslint-disable */" } },
          "typescript",
          "@apollo/client/link/local-resolvers/codegen",
        ],
        config: {
          nonOptionalTypename: true,
          rootValueType: "./rootValue.js#RootValue",
        },
      },
    "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/local-resolvers-with-scalar.ts":
      {
        schema: [
          "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/localSchemaWithScalars.graphql",
        ],
        plugins: [
          { add: { content: "/* eslint-disable */" } },
          "typescript",
          "@apollo/client/link/local-resolvers/codegen",
        ],
        config: {
          nonOptionalTypename: true,
        },
      },
  },
};

export default config;
