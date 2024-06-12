const limits = require("./.size-limits.json");

const checks = [
  {
    path: "dist/apollo-client.min.cjs",
  },
  {
    path: "dist/main.cjs",
    import: "{ ApolloClient, InMemoryCache, HttpLink }",
  },
  {
    path: "dist/index.js",
    import: "{ ApolloClient, InMemoryCache, HttpLink }",
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
  ].map((name) => ({ path: "dist/react/index.js", import: `{ ${name} }` })),
]
  .map((config) => ({
    ...config,
    name:
      config.name || config.import ?
        `import ${config.import} from "${config.path}"`
      : config.path,
    // newer versions of size-limit changed to brotli as a default
    // we'll stay on gzip for now, so results are easier to compare
    gzip: true,
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
      "hoist-non-react-statics",
      "optimism",
      "prop-types",
      "response-iterator",
      "symbol-observable",
      "ts-invariant",
      "tslib",
      "zen-observable-ts",
    ],
  }))
  .flatMap((value) =>
    value.path == "dist/apollo-client.min.cjs" ?
      value
    : [
        value,
        {
          ...value,
          name: `${value.name} (production)`,
          modifyEsbuildConfig(config) {
            config.define = {
              "globalThis.__DEV__": `false`,
            };
            return config;
          },
        },
      ]
  )
  .map((value) => {
    value.limit = limits[value.name];
    return value;
  });

module.exports = checks;
