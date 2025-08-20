---
"@apollo/client-codemod-migrate-3-to-4": major
---

Add a new `clientSetup` codemod step which applies the following steps from the migration guide to your Apollo Client setup code:
  - moves `uri`, `headers` and `credentials` to the `link` option and creates a new `HttpLink` instance
  - moves `name` and `version` into a `clientAwareness` option
  - adds a `localState` option with a new `LocalState` instance, moves `resolvers` in and removes `typeDefs` and `fragmentMatcher` options
  - changes the `conntectToDevTools` option to `devTools.enabled`
  - renames `disableNetworkFetches` to `prioritizeCacheValues`
  - if `dataMasking` is enabled, adds a template for global type augmentation to re-enable data masking types
  - adds the `incrementalHandler` option and adds a template for global type augmentation to accordingly type network responses in custom links
