# Change log

Expect active development and potentially significant breaking changes in the `0.x` track. We'll try to be diligent about releasing a `1.0` version in a timely fashion (ideally within 3 to 6 months), to signal the start of a more stable API.

### vNEXT
- Added support for query composition through fragments [Issue #338](https://github.com/apollostack/apollo-client/issues/338) and [PR #343](https://github.com/apollostack/apollo-client/pull/343)
- **Add `fetchMore` method for for infinite scroll in pagination**
  - This is done by adding to the watched query a `quietFields` array
    that lists all parameters used for pagination that will not be re-inflated
    in the `itemDataId` in the store.
  - `fetchMore` sets a `forceFetch` alongside a `fetchMore` in the new query
    performed. That way, we force data retrieval but indicate to concatenate
    results under the same `itemDataId` in the store.

### v0.3.26

- Exposed a `printAST` method that is just `graphql-js`'s `print` method underneath [PR #337](https://github.com/apollostack/apollo-client/pull/337). With [PR #277](https://github.com/apollostack/apollo-client/pull/277), we moved to using the query AST as the representation of the query passed to the network interface. Unfortunately, this broke implementations of network interfaces. By exposing `printAST`, custom network interface implementations will be able to convert the query AST to a string easily.

### v0.3.25

- Fix regression where options passed to query and watchQuery were modified if `shouldForceFetch` was false. [Issue #339](https://github.com/apollostack/apollo-client/issues/317) [PR #340](https://github.com/apollostack/apollo-client/pull/340)
- **Add flexible mutation result handling to Apollo Client.**
  - This is done by passing an `resultBehaviors` option to `client.mutate`, with an array of "Mutation Result Behaviors".
  - You can attach any number of result behaviors to each mutation.
  - These result behaviors are attached to the `MUTATION_RESULT` redux action that is dispatched when the query result arrives from the store, and are handled by special "Mutation Behavior Reducers". These are similar to regular Redux reducers, but they get a whole bunch of GraphQL-specific information in the arguments, and are all called synchronously in order when the result of a mutation arrives.
  - In this version, Apollo Client ships with a set of default mutation result behaviors/reducers including `ARRAY_INSERT`, `DELETE`, and `ARRAY_DELETE`, but you can add any custom ones you want by passing the new `mutationBehaviorReducers` option to the `ApolloClient` constructor.
  - The previous default functionality of merging all mutation results into the store is preserved.
  - Added `client.dataId` and `client.fieldWithArgs` helpers to generate store paths for mutation behaviors.
  - [PR #320](https://github.com/apollostack/apollo-client/pull/320) [Read the design in depth in Issue #317](https://github.com/apollostack/apollo-client/issues/317)
- Added support for resetting the store [Issue #158](https://github.com/apollostack/apollo-client/issues/158) and [PR #314](https://github.com/apollostack/apollo-client/pull/314).
- Deprecate `apollo-client/gql` for `graphql-tag` and show a meaningful warning when importing
  `apollo-client/gql`

### v0.3.22 + v0.3.23 + v0.3.24

- Fix unintentional breaking change where `apollo-client/gql` import stopped working. [Issue #327](https://github.com/apollostack/apollo-client/issues/327)

### v0.3.21

- Move out GraphQL query parsing into a new package [`graphql-tag`](https://github.com/apollostack/graphql-tag) with a backcompat shim for `apollo-client/gql`. [Issue #312](https://github.com/apollostack/apollo-client/issues/312) [PR #313](https://github.com/apollostack/apollo-client/pull/313)
- Added `ssrMode` (to disable `forceFetch` queries completely) and `ssrForceFetchDelay` (to disable it for a short time period). This is for server-side rendering -- on the server it doesn't make sense to force fetch (you just want a single snapshot of data, not changing data), and when you first re-render on the client, the server's data is up to date, so there's no need to re-fetch. [Issue #298](https://github.com/apollostack/apollo-client/issues/298) [PR #309](https://github.com/apollostack/apollo-client/pull/309)
- `addTypename` query transform now doesn't add extra `__typename` fields where they are already present. [PR #323](https://github.com/apollostack/apollo-client/pull/323)

### v0.3.20

- Exported `writeQueryToStore` and `writeFragmentToStore` directly from `apollo-client` to match `readQueryFromStore` and `readFragmentFromStore`. [PR #311](https://github.com/apollostack/apollo-client/pull/311)
- Add (optional) `returnPartialData` to `readFragmentFromStore` and `readQueryFromStore`. [PR #310](https://github.com/apollostack/apollo-client/pull/310)

### v0.3.19

- Exported `addTypename` query transform directly from `apollo-client` so that it doesn't need to be imported from a submodule. [PR #303](https://github.com/apollostack/apollo-client/pull/303)
- Made network interfaces from `createNetworkInterface` have batching capability by default. [PR #303](https://github.com/apollostack/apollo-client/pull/303)

### v0.3.18

- Solved an issue that occurred when merging two queries with exactly the same query document [Issue #296](https://github.com/apollostack/apollo-client/issues/296) and [PR #299](https://github.com/apollostack/apollo-client/pull/299)

### v0.3.17

- Add `shouldBatch` option to `ApolloClient` constructor, default to `false` for now. [PR #294](https://github.com/apollostack/apollo-client/pull/294)

### v0.3.16

- Implemented query merging and batching support [Issue #164](https://github.com/apollostack/apollo-client/issues/164), [PR #278](https://github.com/apollostack/apollo-client/pull/278) and [PR #277](https://github.com/apollostack/apollo-client/pull/277)

### v0.3.15

- Added support for `@skip` and `@include` directives - see [Issue #237](https://github.com/apollostack/apollo-client/issues/237) and [PR #275](https://github.com/apollostack/apollo-client/pull/275)

### v0.3.14

- Added support for inline object and array arguments in queries and mutations, where previously you had to use variables. [PR #252](https://github.com/apollostack/apollo-client/pull/252)
- Added name fragment support within mutations [Issue #273](https://github.com/apollostack/apollo-client/issues/273) and [PR #274](https://github.com/apollostack/apollo-client/pull/274)
- Now sending the operation name along with the query to the server [Issue #259](https://github.com/apollostack/apollo-client/issues/259) and [PR #282](https://github.com/apollostack/apollo-client/pull/282)

### v0.3.13

- Removed AuthTokenHeaderMiddleware code and related tests from apollo-client [Issue #247](https://github.com/apollostack/apollo-client/issues/247)
- Added named fragment support [Issue #80](https://github.com/apollostack/apollo-client/issues/80) and [PR #251](https://github.com/apollostack/apollo-client/pull/251).
- Added basic guards to our Redux Store `subscribe` to prevent `broadcastQueries` from being called unnecessarily
- Fixed polling leak issue that occured with multiple polling queries (https://github.com/apollostack/apollo-client/issues/248)
- add whatwg-fetch to fix promise problems with fetch (catch error '{}') that occurs in special browser/older browser (eg. Wechat browser in China )[PR #256](https://github.com/apollostack/apollo-client/pull/256).
- updated graphql dependency to include ^0.6.0

### v0.3.12

- Fix query transformation for queries called with `forceFetch`. [PR #240](https://github.com/apollostack/apollo-client/pull/240)

### v0.3.11

- Add support for basic query transformation before submitting to the server by passing an option to `ApolloClient` constructor. (e.g. adding `__typename` to each SelectionSet) [Issue #230](https://github.com/apollostack/apollo-client/issues/230) [PR #233](https://github.com/apollostack/apollo-client/pull/233)

### v0.3.10

- Resolve a race condition between `QueryManager` `stopQuery()` and `broadcastQueries()`, which would result in an error `listener is not a function`. [Issue #231](https://github.com/apollostack/apollo-client/issues/231) [PR #232](https://github.com/apollostack/apollo-client/pull/232)

### v0.3.9

- Namespace Apollo action types to prevent collision with user's own Redux action types. [Issue #210](https://github.com/apollostack/apollo-client/issues/210) [PR #222](https://github.com/apollostack/apollo-client/pull/222)
- Queries on refetch return promises. [PR #178](https://github.com/apollostack/apollo-client/pull/178)

### v0.3.8

- Add support for [GraphQLJSON](https://github.com/taion/graphql-type-json) scalar type by changing the way we identify scalar types when writing to the store. [Issue #217](https://github.com/apollostack/apollo-client/issues/217) [PR #219](https://github.com/apollostack/apollo-client/pull/219)

### v0.3.7

- Add `dataIdFromObject` option to `ApolloClient` constructor, to allow data normalization. This function should take a GraphQL result object, and return an ID if one can be found. [Issue #204](https://github.com/apollostack/apollo-client/issues/204) [PR #214](https://github.com/apollostack/apollo-client/pull/214)

### v0.3.6

- Use `console.error` to log unhandled network errors. [Issue #189](https://github.com/apollostack/apollo-client/issues/189) [PR #203](https://github.com/apollostack/apollo-client/pull/203)
- Suggest using variables instead of inline arguments for non-scalar types. [Issue #202](https://github.com/apollostack/apollo-client/issues/202) [PR #211](https://github.com/apollostack/apollo-client/pull/211)

### v0.3.5

- Improve error message when a dev forgets `gql` to link to docs. [PR #181](https://github.com/apollostack/apollo-client/pull/181)
- Memoize results from `gql`, so that we save time on parsing, and we can use `===` to compare queries for performance. [Issue #199](https://github.com/apollostack/apollo-client/issues/199) [PR #200](https://github.com/apollostack/apollo-client/pull/200)
- Fix error when using `returnPartialData`. [Issue #193](https://github.com/apollostack/apollo-client/issues/193) [PR #201](https://github.com/apollostack/apollo-client/pull/201)
- Add basic interoperability with other Observable implementations like RxJS. [Issue #149](https://github.com/apollostack/apollo-client/issues/149) [PR #196](https://github.com/apollostack/apollo-client/pull/196)

### v0.3.4

- Fix improperly published package that broke submodule paths. [Issue #186](https://github.com/apollostack/apollo-client/issues/186)

### v0.3.3

- Fix regression from 0.3.2 that broke root query diffing
- Enhance query printer so that it can print multiple root queries [Issue #184](https://github.com/apollostack/apollo-client/issues/184) [react-apollo issue #45](https://github.com/apollostack/react-apollo/issues/45) [PR #185](https://github.com/apollostack/apollo-client/pull/185)

### v0.3.2

- Added support for inline fragments. [Issue #147](https://github.com/apollostack/apollo-client/issues/147) [PR #175](https://github.com/apollostack/apollo-client/pull/175)
- Removed vestigial code that partially implemented refetching via the Relay Node interface, but was not possible to use through the public API.

### v0.3.1

- Made client more robust in the case where the server returns an empty error array, even though that's not in the GraphQL spec. [Issue #156](https://github.com/apollostack/apollo-client/issues/155) [PR #173](https://github.com/apollostack/apollo-client/pull/173)

### v0.3.0

- **Breaking change:** Require all queries to be wrapped with a `gql` template literal tag, and throw an error when they aren't. [Issue #155](https://github.com/apollostack/apollo-client/issues/155) [PR #168](https://github.com/apollostack/apollo-client/pull/168)
- Remove all dependencies on the `graphql` parser module at runtime, except for the `gql` template literal tag, so that queries can be pre-parsed in production to save on parsing overhead.
- Add everything that isn't a compiled file to `npmignore`. [PR #165](https://github.com/apollostack/apollo-client/pull/165)
- Move importable modules to root. [PR #169](https://github.com/apollostack/apollo-client/pull/169)

### v0.2.0

- Add polling functionality to `watchQuery`. [Issue #145](https://github.com/apollostack/apollo-client/issues/145) [PR #153](https://github.com/apollostack/apollo-client/pull/153)

### v0.1.0

Initial release. We didn't track changes before this version.
