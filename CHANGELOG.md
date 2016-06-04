# Change log

Expect active development and potentially significant breaking changes in the `0.x` track. We'll try to be diligent about releasing a `1.0` version in a timely fashion (ideally within 3 to 6 months), to signal the start of a more stable API.

### vNEXT
- Removed AuthTokenHeaderMiddleware code and related tests from apollo-client [Issue #247](https://github.com/apollostack/apollo-client/issues/247)
- Added named fragment support [Issue #80](https://github.com/apollostack/apollo-client/issues/80) and [PR #251](https://github.com/apollostack/apollo-client/pull/251).
- Added basic guards to our Redux Store `subscribe` to prevent `broadcastQueries` from being called unnecessarily
- Fixed polling leak issue that occured with multiple polling queries (https://github.com/apollostack/apollo-client/issues/248)
- add whatwg-fetch to fix promise problems with fetch (catch error '{}') that occurs in special browser/older browser (eg. Wechat browser in China )

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
