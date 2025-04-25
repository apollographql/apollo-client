import type { CodegenConfig } from "@graphql-codegen/cli";
// @ts-ignore todo: determine if we can remove this ignore
import { createLocalResolversLinkCodegenConfig } from "@apollo/client/link/local-resolvers/codegen";

const config: CodegenConfig = {
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
  generates: {
    "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/local-resolvers.ts":
      createLocalResolversLinkCodegenConfig({
        schema: [
          "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/localSchema.graphql",
        ],
        plugins: [{ add: { content: "/* eslint-disable */" } }],
      }),
    "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/local-resolvers-with-scalar.ts":
      createLocalResolversLinkCodegenConfig({
        schema: [
          "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/localSchemaWithScalars.graphql",
        ],
        plugins: [{ add: { content: "/* eslint-disable */" } }],
      }),
  },
};

export default config;
