const limits = require("./.size-limits.json");

const checks = [
  {
    import: { "@apollo/client": "{ ApolloClient, InMemoryCache, HttpLink }" },
    conditions: ["require"],
  },
  {
    import: { "@apollo/client": "{ ApolloClient, InMemoryCache, HttpLink }" },
  },
  ...[
    "ApolloProvider",
    "useQuery",
    "useLazyQuery",
    "useMutation",
    "useSubscription",
    "useSuspenseQuery",
    "useBackgroundQuery",
    "useLoadableQuery",
    "useReadQuery",
    "useFragment",
  ].map((name) => ({ import: { "@apollo/client/react": `{ ${name} }` } })),
]
  .map((config) => ({
    ...config,
    name:
      config.name || config.import ?
        `import ${Object.values(config.import)[0]} from "${
          Object.keys(config.import)[0]
        }"`
      : config.path,
    brotli: true,
    ignore: [
      ...(config.ignore || []),
      "rehackt",
      "react",
      "react-dom",
      "@graphql-typed-document-node/core",
      "@wry/caches",
      "@wry/context",
      "@wry/equality",
      "@wry/trie",
      "graphql-tag",
      "optimism",
      "prop-types",
      "response-iterator",
      "symbol-observable",
      "ts-invariant",
      "tslib",
      "zen-observable-ts",
    ],
  }))
  .flatMap((value) => [
    {
      ...value,
      conditions: ["development"].concat(
        value.conditions || ["module", "browser"]
      ),
    },
    {
      ...value,
      name: `${value.name} (production)`,
      conditions: ["production"].concat(
        value.conditions || ["module", "browser"]
      ),
    },
  ])
  .map((value) => {
    value.limit = limits[value.name];
    const conditions = value.conditions;
    delete value.conditions;
    if (conditions.includes("require")) {
      value.name = `${value.name} (CJS)`;
    }
    value.modifyEsbuildConfig = (config) => {
      config.conditions = conditions;
      return config;
    };
    return value;
  });

module.exports = checks;
