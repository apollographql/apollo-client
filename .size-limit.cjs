const limits = require("./.size-limits.json");

/* prettier-ignore */
const nameMapping = {
  'import { ApolloClient, InMemoryCache, HttpLink } from "dist/main.cjs"':              'import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client" (CJS)',
  'import { ApolloClient, InMemoryCache, HttpLink } from "dist/main.cjs" (production)': 'import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client" (production) (CJS)',
  'import { ApolloClient, InMemoryCache, HttpLink } from "dist/index.js"':              'import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client"',
  'import { ApolloClient, InMemoryCache, HttpLink } from "dist/index.js" (production)': 'import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client" (production)',
  'import { ApolloProvider } from "dist/react/index.js"':                               'import { ApolloProvider } from "@apollo/client/react"',
  'import { ApolloProvider } from "dist/react/index.js" (production)':                  'import { ApolloProvider } from "@apollo/client/react" (production)',
  'import { useQuery } from "dist/react/index.js"':                                     'import { useQuery } from "@apollo/client/react"',
  'import { useQuery } from "dist/react/index.js" (production)':                        'import { useQuery } from "@apollo/client/react" (production)',
  'import { useLazyQuery } from "dist/react/index.js"':                                 'import { useLazyQuery } from "@apollo/client/react"',
  'import { useLazyQuery } from "dist/react/index.js" (production)':                    'import { useLazyQuery } from "@apollo/client/react"',
  'import { useMutation } from "dist/react/index.js"':                                  'import { useMutation } from "@apollo/client/react"',
  'import { useMutation } from "dist/react/index.js" (production)':                     'import { useMutation } from "@apollo/client/react" (production)',
  'import { useSubscription } from "dist/react/index.js"':                              'import { useSubscription } from "@apollo/client/react"',
  'import { useSubscription } from "dist/react/index.js" (production)':                 'import { useSubscription } from "@apollo/client/react" (production)',
  'import { useSuspenseQuery } from "dist/react/index.js"':                             'import { useSuspenseQuery } from "@apollo/client/react"',
  'import { useSuspenseQuery } from "dist/react/index.js" (production)':                'import { useSuspenseQuery } from "@apollo/client/react" (production)',
  'import { useBackgroundQuery } from "dist/react/index.js"':                           'import { useBackgroundQuery } from "@apollo/client/react"',
  'import { useBackgroundQuery } from "dist/react/index.js" (production)':              'import { useBackgroundQuery } from "@apollo/client/react" (production)',
  'import { useLoadableQuery } from "dist/react/index.js"':                             'import { useLoadableQuery } from "@apollo/client/react"',
  'import { useLoadableQuery } from "dist/react/index.js" (production)':                'import { useLoadableQuery } from "@apollo/client/react" (production)',
  'import { useReadQuery } from "dist/react/index.js"':                                 'import { useReadQuery } from "@apollo/client/react"',
  'import { useReadQuery } from "dist/react/index.js" (production)':                    'import { useReadQuery } from "@apollo/client/react" (production)',
  'import { useFragment } from "dist/react/index.js"':                                  'import { useFragment } from "@apollo/client/react"',
  'import { useFragment } from "dist/react/index.js" (production)':                     'import { useFragment } from "@apollo/client/react" (production)',
};

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
    value.name = nameMapping[value.name] || value.name;
    value.limit = limits[value.name];
    return value;
  });

module.exports = checks;
