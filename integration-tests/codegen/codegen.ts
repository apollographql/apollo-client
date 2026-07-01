import type { CodegenConfig } from "@graphql-codegen/cli";

const fixtures = "../../src/local-state/__tests__/LocalState/fixtures";

const config: CodegenConfig = {
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
  generates: {
    [`${fixtures}/local-resolvers.ts`]: {
      schema: [`${fixtures}/localSchema.graphql`],
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
    [`${fixtures}/local-resolvers-without-context-value.ts`]: {
      schema: [`${fixtures}/localSchema.graphql`],
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
