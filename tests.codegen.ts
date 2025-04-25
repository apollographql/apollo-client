import type { CodegenConfig } from "@graphql-codegen/cli";
// @ts-ignore todo: determine if we can remove this ignore
import { localResolversCodegenConfig } from "@apollo/client/link/local-resolvers/codegen";

const config: CodegenConfig = {
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
  generates: {
    "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/local-resolvers.ts":
      localResolversCodegenConfig({
        schema: [
          "./src/link/local-resolvers/__tests__/LocalResolversLink/fixtures/localSchema.graphql",
        ],
        plugins: [{ add: { content: "/* eslint-disable */" } }],
      }),
  },
};

export default config;
