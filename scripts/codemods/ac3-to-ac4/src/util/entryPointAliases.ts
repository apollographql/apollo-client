/*
```sh
jq --slurpfile packages <(find . -name package.json | xargs cat) '$packages|map({key:.name, value: [.name+"/"+.main,.name+"/"+.module]})|from_entries' <(echo '{}')
```
*/
const fromPackageJson = {
  "@apollo/client/core": [
    "@apollo/client/core/core.cjs",
    "@apollo/client/core/index.js",
  ],
  "@apollo/client/cache": [
    "@apollo/client/cache/cache.cjs",
    "@apollo/client/cache/index.js",
  ],
  "@apollo/client/utilities/globals": [
    "@apollo/client/utilities/globals/globals.cjs",
    "@apollo/client/utilities/globals/index.js",
  ],
  "@apollo/client/utilities/subscriptions/urql": [
    "@apollo/client/utilities/subscriptions/urql/urql.cjs",
    "@apollo/client/utilities/subscriptions/urql/index.js",
  ],
  "@apollo/client/utilities/subscriptions/relay": [
    "@apollo/client/utilities/subscriptions/relay/relay.cjs",
    "@apollo/client/utilities/subscriptions/relay/index.js",
  ],
  "@apollo/client/utilities": [
    "@apollo/client/utilities/utilities.cjs",
    "@apollo/client/utilities/index.js",
  ],
  "@apollo/client/testing/experimental": [
    "@apollo/client/testing/experimental/experimental.cjs",
    "@apollo/client/testing/experimental/index.js",
  ],
  "@apollo/client/testing/core": [
    "@apollo/client/testing/core/core.cjs",
    "@apollo/client/testing/core/index.js",
  ],
  "@apollo/client/testing": [
    "@apollo/client/testing/testing.cjs",
    "@apollo/client/testing/index.js",
  ],
  "@apollo/client/link/remove-typename": [
    "@apollo/client/link/remove-typename/remove-typename.cjs",
    "@apollo/client/link/remove-typename/index.js",
  ],
  "@apollo/client/link/context": [
    "@apollo/client/link/context/context.cjs",
    "@apollo/client/link/context/index.js",
  ],
  "@apollo/client/link/core": [
    "@apollo/client/link/core/core.cjs",
    "@apollo/client/link/core/index.js",
  ],
  "@apollo/client/link/retry": [
    "@apollo/client/link/retry/retry.cjs",
    "@apollo/client/link/retry/index.js",
  ],
  "@apollo/client/link/utils": [
    "@apollo/client/link/utils/utils.cjs",
    "@apollo/client/link/utils/index.js",
  ],
  "@apollo/client/link/subscriptions": [
    "@apollo/client/link/subscriptions/subscriptions.cjs",
    "@apollo/client/link/subscriptions/index.js",
  ],
  "@apollo/client/link/schema": [
    "@apollo/client/link/schema/schema.cjs",
    "@apollo/client/link/schema/index.js",
  ],
  "@apollo/client/link/http": [
    "@apollo/client/link/http/http.cjs",
    "@apollo/client/link/http/index.js",
  ],
  "@apollo/client/link/batch": [
    "@apollo/client/link/batch/batch.cjs",
    "@apollo/client/link/batch/index.js",
  ],
  "@apollo/client/link/batch-http": [
    "@apollo/client/link/batch-http/batch-http.cjs",
    "@apollo/client/link/batch-http/index.js",
  ],
  "@apollo/client/link/error": [
    "@apollo/client/link/error/error.cjs",
    "@apollo/client/link/error/index.js",
  ],
  "@apollo/client/link/persisted-queries": [
    "@apollo/client/link/persisted-queries/persisted-queries.cjs",
    "@apollo/client/link/persisted-queries/index.js",
  ],
  "@apollo/client/link/ws": [
    "@apollo/client/link/ws/ws.cjs",
    "@apollo/client/link/ws/index.js",
  ],
  "@apollo/client": ["@apollo/client/./main.cjs", "@apollo/client/./index.js"],
  "@apollo/client/dev": [
    "@apollo/client/dev/dev.cjs",
    "@apollo/client/dev/index.js",
  ],
  "@apollo/client/errors": [
    "@apollo/client/errors/errors.cjs",
    "@apollo/client/errors/index.js",
  ],
  "@apollo/client/react/context": [
    "@apollo/client/react/context/context.cjs",
    "@apollo/client/react/context/index.js",
  ],
  "@apollo/client/react/hoc": [
    "@apollo/client/react/hoc/hoc.cjs",
    "@apollo/client/react/hoc/index.js",
  ],
  "@apollo/client/react/internal": [
    "@apollo/client/react/internal/internal.cjs",
    "@apollo/client/react/internal/index.js",
  ],
  "@apollo/client/react/parser": [
    "@apollo/client/react/parser/parser.cjs",
    "@apollo/client/react/parser/index.js",
  ],
  "@apollo/client/react/ssr": [
    "@apollo/client/react/ssr/ssr.cjs",
    "@apollo/client/react/ssr/index.js",
  ],
  "@apollo/client/react/components": [
    "@apollo/client/react/components/components.cjs",
    "@apollo/client/react/components/index.js",
  ],
  "@apollo/client/react": [
    "@apollo/client/react/react.cjs",
    "@apollo/client/react/index.js",
  ],
  "@apollo/client/react/hooks": [
    "@apollo/client/react/hooks/hooks.cjs",
    "@apollo/client/react/hooks/index.js",
  ],
  "@apollo/client/masking": [
    "@apollo/client/masking/masking.cjs",
    "@apollo/client/masking/index.js",
  ],
} satisfies Record<string, string[]>;

export const entryPointAliases = {
  ...fromPackageJson,
  "@apollo/client/core": [] as string[],
  "@apollo/client": [
    "@apollo/client/apollo-client.cjs",
    "@apollo/client/apollo-client.min.cjs",
    "@apollo/client/index.js",
    "@apollo/client/main.cjs",
    "@apollo/client/main.cjs.native.js",
    ...fromPackageJson["@apollo/client/core"],
  ],
  "@apollo/client/link/core": [] as string[],
  "@apollo/client/link": fromPackageJson["@apollo/client/link/core"],
} satisfies Record<string, string[]>;
