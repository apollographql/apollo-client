const checks = [
  {
    path: "dist/apollo-client.min.cjs",
    limit: "38010",
  },
  {
    path: "dist/main.cjs",
    import: "{ ApolloClient, InMemoryCache, HttpLink }",
  },
  {
    path: "dist/index.js",
    import: "{ ApolloClient, InMemoryCache, HttpLink }",
    limit: "32070",
  },
  ...[
    "ApolloProvider",
    "useQuery",
    "useLazyQuery",
    "useMutation",
    "useSubscription",
    "useSuspenseQuery",
    "useBackgroundQuery",
    "useReadQuery",
    "useFragment",
  ].map((name) => ({ path: "dist/react/index.js", import: `{ ${name} }` })),
]
  .map((config) => ({
    ...config,
    name:
      config.name || config.import
        ? `import ${config.import} from "${config.path}"`
        : config.path,
    ignore: [
      ...(config.ignore || []),
      "react",
      "react-dom",
      "@graphql-typed-document-node/core",
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
    value.path == "dist/apollo-client.min.cjs"
      ? value
      : [
          { ...value, limit: undefined },
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
  );

module.exports = checks;
