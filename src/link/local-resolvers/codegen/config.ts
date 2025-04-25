import { mergeDeep } from "@apollo/client/utilities";

const defaultConfig = {
  avoidOptionals: {
    field: true,
  },
};

export function localResolversCodegenConfig(
  baseConfig: import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput
) {
  const plugins = baseConfig.plugins ?? [];

  return {
    ...baseConfig,
    plugins: [
      ...new Set(plugins.concat(["typescript", "typescript-resolvers"])),
    ],
    config: mergeDeep(
      defaultConfig,
      // If `baseConfig.config` is `null` or `undefined`, it replaces
      // `defaultConfig` rather than using` defaultConfig` as the base. To
      // ensure `defaultConfig` is applied when `baseConfig.config` is not
      // provided, we use it as the default value here.
      baseConfig.config ?? defaultConfig,
      {
        avoidOptionals: {
          query: true,
          mutation: true,
          subscription: true,
        },
        makeResolverTypeCallable: true,
        customResolverFn:
          "@apollo/client/link/local-resolvers/codegen#LocalResolversLinkResolverFn",
      }
    ),
  } satisfies import("@graphql-codegen/plugin-helpers").Types.ConfiguredOutput;
}
