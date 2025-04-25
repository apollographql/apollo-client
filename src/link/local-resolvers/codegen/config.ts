import { mergeDeep } from "@apollo/client/utilities";

export function localResolversCodegenConfig(
  baseConfig: import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput
) {
  const plugins = baseConfig.plugins ?? [];

  return {
    ...baseConfig,
    plugins: [
      ...new Set(plugins.concat(["typescript", "typescript-resolvers"])),
    ],
    config: mergeDeep(baseConfig.config, {
      avoidOptionals: {
        query: true,
        mutation: true,
        subscription: true,
      },
      makeResolverTypeCallable: true,
      customResolverFn:
        "@apollo/client/link/local-resolvers/codegen#LocalResolversLinkResolverFn",
    }),
  } satisfies import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput;
}
