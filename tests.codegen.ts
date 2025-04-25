import type { CodegenConfig } from "@graphql-codegen/cli";

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
          "typescript-resolvers",
        ],
      },
  },
};

export default config;
