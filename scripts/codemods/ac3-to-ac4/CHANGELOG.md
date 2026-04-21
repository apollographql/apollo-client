# @apollo/client-codemod-migrate-3-to-4

## 1.0.2

### Patch Changes

- [#12879](https://github.com/apollographql/apollo-client/pull/12879) [`56b2094`](https://github.com/apollographql/apollo-client/commit/56b20945a2c3d3fb227d5ede3b705a5c58801b7d) Thanks [@phryneas](https://github.com/phryneas)! - Fix an issue where `networkStatus` would not be moved into the correct package.

## 1.0.1

### Patch Changes

- [#12866](https://github.com/apollographql/apollo-client/pull/12866) [`0d1614a`](https://github.com/apollographql/apollo-client/commit/0d1614a9dfca2b1bcf4ea40095cc9018d6314532) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Export `isNetworkStatusInFlight` from `@apollo/client/utilities`. Add `isNetworkStatusSettled` to `@apollo/client/utilities` and re-export it from `@apollo/client` with a deprecation.

## 1.0.0

### Major Changes

- [#12727](https://github.com/apollographql/apollo-client/pull/12727) [`b845906`](https://github.com/apollographql/apollo-client/commit/b8459062caae96447b4867be75a853aa1943ec31) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a codemod that renames old import locations from 3.x entrypoint to their 4.x entrypoint.

  Run the codemod using the following command:

  ```sh
  npx @apollo/client-codemod-migrate-3-to-4 --parser tsx ./src/**/*.{ts,tsx}
  ```

  The codemod supports `.js`, `.jsx`, `.ts`, and `.tsx` files.

- [#12851](https://github.com/apollographql/apollo-client/pull/12851) [`32bc830`](https://github.com/apollographql/apollo-client/commit/32bc8302f1a8a2107da275e72a20d64014247618) Thanks [@phryneas](https://github.com/phryneas)! - Add a new `clientSetup` codemod step which applies the following steps from the migration guide to your Apollo Client setup code:
  - Moves `uri`, `headers` and `credentials` to the `link` option and creates a new `HttpLink` instance
  - Moves `name` and `version` into a `clientAwareness` option
  - Adds a `localState` option with a new `LocalState` instance, moves `resolvers`, and removes `typeDefs` and `fragmentMatcher` options
  - Changes the `connectToDevTools` option to `devtools.enabled`
  - Renames `disableNetworkFetches` to `prioritizeCacheValues`
  - If `dataMasking` is enabled, adds a template for global type augmentation to re-enable data masking types
  - Adds the `incrementalHandler` option and adds a template for global type augmentation to accordingly type network responses in custom links

### Minor Changes

- [#12818](https://github.com/apollographql/apollo-client/pull/12818) [`d1e9503`](https://github.com/apollographql/apollo-client/commit/d1e9503eb58325529f0f0dc8b0cb07cf05431ee3) Thanks [@phryneas](https://github.com/phryneas)! - Extend `imports` codemod, add new `links` and `removals` (via #12838) codemods.

### Patch Changes

- [#12846](https://github.com/apollographql/apollo-client/pull/12846) [`71ccfb5`](https://github.com/apollographql/apollo-client/commit/71ccfb5226937b14d4d4f59c46eea2a8cacd6700) Thanks [@phryneas](https://github.com/phryneas)! - Add a new `legacyEntryPoints` transformation step that moves imports from old legacy entry points like `@apollo/client/main.cjs` or `@apollo/client/react/react.cjs` to the new entry points like `@apollo/client` or `@apollo/client/react`.

- [#12775](https://github.com/apollographql/apollo-client/pull/12775) [`454ec78`](https://github.com/apollographql/apollo-client/commit/454ec78b751853da07243174a6f9bdc4535e7e8f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Don't export `gql` from `@apollo/client/react` entrypoint. Import from `@apollo/client` instead.

- [#12858](https://github.com/apollographql/apollo-client/pull/12858) [`6440e8b`](https://github.com/apollographql/apollo-client/commit/6440e8bc6c42ed2f97ccabac987e10f3c81d90b4) Thanks [@phryneas](https://github.com/phryneas)! - adjust the `clientSetup` codemod so that it removes the `TCacheShape` type argument from all `ApolloClient` usages (types and constructor calls).

## 1.0.0-rc.3

### Major Changes

- [#12851](https://github.com/apollographql/apollo-client/pull/12851) [`32bc830`](https://github.com/apollographql/apollo-client/commit/32bc8302f1a8a2107da275e72a20d64014247618) Thanks [@phryneas](https://github.com/phryneas)! - Add a new `clientSetup` codemod step which applies the following steps from the migration guide to your Apollo Client setup code:
  - Moves `uri`, `headers` and `credentials` to the `link` option and creates a new `HttpLink` instance
  - Moves `name` and `version` into a `clientAwareness` option
  - Adds a `localState` option with a new `LocalState` instance, moves `resolvers`, and removes `typeDefs` and `fragmentMatcher` options
  - Changes the `connectToDevTools` option to `devtools.enabled`
  - Renames `disableNetworkFetches` to `prioritizeCacheValues`
  - If `dataMasking` is enabled, adds a template for global type augmentation to re-enable data masking types
  - Adds the `incrementalHandler` option and adds a template for global type augmentation to accordingly type network responses in custom links

### Patch Changes

- [#12846](https://github.com/apollographql/apollo-client/pull/12846) [`71ccfb5`](https://github.com/apollographql/apollo-client/commit/71ccfb5226937b14d4d4f59c46eea2a8cacd6700) Thanks [@phryneas](https://github.com/phryneas)! - Add a new `legacyEntryPoints` transformation step that moves imports from old legacy entry points like `@apollo/client/main.cjs` or `@apollo/client/react/react.cjs` to the new entry points like `@apollo/client` or `@apollo/client/react`.

## 1.0.0-rc.2

### Minor Changes

- [#12818](https://github.com/apollographql/apollo-client/pull/12818) [`d1e9503`](https://github.com/apollographql/apollo-client/commit/d1e9503eb58325529f0f0dc8b0cb07cf05431ee3) Thanks [@phryneas](https://github.com/phryneas)! - Extend `imports` codemod, add new `links` and `removals` (via #12838) codemods.

## 1.0.0-rc.1

### Patch Changes

- [#12775](https://github.com/apollographql/apollo-client/pull/12775) [`454ec78`](https://github.com/apollographql/apollo-client/commit/454ec78b751853da07243174a6f9bdc4535e7e8f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Don't export `gql` from `@apollo/client/react` entrypoint. Import from `@apollo/client` instead.

## 1.0.0-rc.0

### Major Changes

- [#12727](https://github.com/apollographql/apollo-client/pull/12727) [`b845906`](https://github.com/apollographql/apollo-client/commit/b8459062caae96447b4867be75a853aa1943ec31) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a codemod that renames old import locations from 3.x entrypoint to their 4.x entrypoint.

  Run the codemod using the following command:

  ```sh
  npx @apollo/client-codemod-migrate-3-to-4 --parser tsx ./src/**/*.{ts,tsx}
  ```

  The codemod supports `.js`, `.jsx`, `.ts`, and `.tsx` files.
