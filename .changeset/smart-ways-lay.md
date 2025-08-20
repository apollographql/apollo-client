---
"@apollo/client-codemod-migrate-3-to-4": major
---

Add a new `clientSetup` codemod step which applies the following steps from the migration guide to your Apollo Client setup code:
  - Moves `uri`, `headers` and `credentials` to the `link` option and creates a new `HttpLink` instance
  - Moves `name` and `version` into a `clientAwareness` option
  - Adds a `localState` option with a new `LocalState` instance, moves `resolvers`, and removes `typeDefs` and `fragmentMatcher` options
  - Changes the `connectToDevTools` option to `devtools.enabled`
  - Renames `disableNetworkFetches` to `prioritizeCacheValues`
  - If `dataMasking` is enabled, adds a template for global type augmentation to re-enable data masking types
  - Adds the `incrementalHandler` option and adds a template for global type augmentation to accordingly type network responses in custom links
