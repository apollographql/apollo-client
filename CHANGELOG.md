# Change log

Expect active development and potentially significant breaking changes in the `0.x` track. We'll try to be diligent about releasing a `1.0` version in a timely fashion (ideally within 3 to 6 months), to signal the start of a more stable API.

### vNEXT
- Fix: Warn but do not fail when refetchQueries includes an unknown query name [PR #700](https://github.com/apollostack/apollo-client/pull/700)

### v0.4.19
- Fix: set default reduxRootKey for backwards-compatibility when using ApolloClient as middleware  [PR #688](https://github.com/apollostack/apollo-client/pull/688)

### v0.4.18

- Fix bug with null fragments introduced in 0.4.16 [PR #683](https://github.com/apollostack/apollo-client/pull/683)
- Set reduxRootKey for backwards-compatibility, even when using reduxRootSelector [PR #685](https://github.com/apollostack/apollo-client/pull/683)

### v0.4.17

- This version is identical to 0.4.15. It was published over 0.4.16 because that had some unintentional breaking changes. Once the breaks are identified and fixed, there will be a 0.4.18 with the new features.

### v0.4.16 (deprecated, had breaking changes)

- **Backwards compatible deprecation** Add a `reduxRootSelector` option and deprecate `reduxRootKey`. This will allow people to put Apollo anywhere they like, even inside a store otherwise managed by ImmutableJS. Note: if you pass a `reduxRootKey` in this version, it will automatically create a `reduxRootSelector` for you, and attach it to the `ApolloClient` instance as before, but this behavior will be removed in `0.5`. [PR #631](https://github.com/apollostack/apollo-client/pull/631)
- Make sure stopping a poll interval doesn't stop updates from the store. [PR #625](https://github.com/apollostack/apollo-client/pull/625)
- Include more type definitions and methods in root export for use in react-apollo [PR #619](https://github.com/apollostack/apollo-client/pull/619)
- Added `resultTransformer` and `resultComparator` to `ApolloClient`/`QueryManager`, which afford the ability to transform result objects immediately before they are returned to the application. [PR #446](https://github.com/apollostack/apollo-client/pull/446)
- Fixed issue with nested fragments overriding each other. [PR #629](https://github.com/apollostack/apollo-client/pull/629)

### v0.4.15

- Options set in middleware can override the fetch query in the network layer. [Issue #627](https://github.com/apollostack/apollo-client/issues/627) and [PR #628](https://github.com/apollostack/apollo-client/pull/628).
- Make `returnPartialData` work better with fragments. [PR #580](https://github.com/apollostack/apollo-client/pull/580)

### v0.4.14

- Avoid extra `assign` when there are no optimistic updates present. [PR #597]((https://github.com/apollostack/apollo-client/pull/597)
- Fixed issue with error passing with query merging. [PR #589](https://github.com/apollostack/apollo-client/pull/589) and [Issue #551](https://github.com/apollostack/apollo-client/issues/551).
- Allow network interface middlewares to change the `req.request` object to add additional fields to the request body. [PR #548](https://github.com/apollostack/apollo-client/pull/548) and [Issue #547](https://github.com/apollostack/apollo-client/issues/547).
- Fixed an issue with batching and variables used in directives. [PR #584](https://github.com/apollostack/apollo-client/pull/584) and [Issue #577](https://github.com/apollostack/apollo-client/issues/577).
- Implemented transport-level batching the way it is currently supported within Apollo Server. [PR #531](https://github.com/apollostack/apollo-client/pull/531) and [Issue #505](https://github.com/apollostack/apollo-client/issues/505).
- [Experimental] Change subscription API to `subscribe` function on Apollo Client instance, and remove `fetchMore`-style API temporarily.

### v0.4.13

- Fix issue where starting, stopping, then starting a polling query with the same interval wasn't handled correctly by the scheduler. Opened as [PR #555](https://github.com/apollostack/apollo-client/pull/555) and merged via [PR #568](https://github.com/apollostack/apollo-client/pull/568).
- Fixed an issue with used variables in directives related to unused variables stripping [PR #563](https://github.com/apollostack/apollo-client/pull/563) and [Issue #562](https://github.com/apollostack/apollo-client/issues/562)
- Change subscription API to use `updateQuery`, like `fetchMore` does, instead of `updateFunction`. [PR #574](https://github.com/apollostack/apollo-client/pull/574)

### v0.4.12

- Fixed an issue with named fragments in batched queries. [PR #509](https://github.com/apollostack/apollo-client/pull/509) and [Issue #501](https://github.com/apollostack/apollo-client/issues/501).
- Fixed an issue with unused variables in queries after diffing queries against information available in the store. [PR #518](https://github.com/apollostack/apollo-client/pull/518) and [Issue #496](https://github.com/apollostack/apollo-client/issues/496).
- Add code to support GraphQL subscriptions. [PR #540](https://github.com/apollostack/apollo-client/pull/540).
- Fixed a couple of issues within query merging that caused issues with null values or arrays in responses. [PR #523](https://github.com/apollostack/apollo-client/pull/523).
- Added an `updateQuery` method on observable queries. Allows application code to arbitrary change the result of a query normalized to store, without issuing any network requests. [PR #506](https://github.com/apollostack/apollo-client/pull/506) and [Issue #495](https://github.com/apollostack/apollo-client/issues/495).
- Fixed issue where result of fetchMore from server wasn't being passed through [PR #508](https://github.com/apollostack/apollo-client/pull/508)

### v0.4.11

- Added an `refetchQueries` option to `mutate`. The point is to just refetch certain queries on a mutation rather than having to manually specify how the result should be incorporated for each of them with `updateQueries`. [PR #482](https://github.com/apollostack/apollo-client/pull/482) and [Issue #448](https://github.com/apollostack/apollo-client/issues/448).
- Print errors produced by application-supplied reducer functions passed to `updateQueries` or `updateQuery` options for `mutate` or `fetchMore` respectively. [PR #500](https://github.com/apollostack/apollo-client/pull/500) and [Issue #479](https://github.com/apollostack/apollo-client/issues/479).

### v0.4.10

- Fixed issue with alias names in batched queries. [PR #493](https://github.com/apollostack/apollo-client/pull/493) and [Issue #490](https://github.com/apollostack/apollo-client/issues).
- Add loading state tracking within Apollo Client in order to simplify the handling of loading state within the view layers. [Issue #342](https://github.com/apollostack/apollo-client/issues/342) and [PR #467](https://github.com/apollostack/apollo-client/pull/467)

- Fixed the way new variables extend the original arguments when passed to methods `fetchMore` and `refetch`. [PR #497](https://github.com/apollostack/apollo-client/pull/497).

### v0.4.9

- Fixed issue with `fragments` array for `updateQueries`. [PR #475](https://github.com/apollostack/apollo-client/pull/475) and [Issue #470](https://github.com/apollostack/apollo-client/issues/470).
- Add a new experimental feature to observable queries called `fetchMore`. It allows application developers to update the results of a query in the store by issuing new queries. We are currently testing this feature internally and we will document it once it is stable. [PR #472](https://github.com/apollostack/apollo-client/pull/472).

### v0.4.8

- Add `useAfter` function that accepts `afterwares`. Afterwares run after a request is made (after middlewares). In the afterware function, you get the whole response and request options, so you can handle status codes and errors if you need to. For example, if your requests return a `401` in the case of user logout, you can use this to identify when that starts happening. It can be used just as a `middleware` is used. Just pass an array of afterwares to the `useAfter` function.
- Fix issues with union type handling for inline and named fragments. [PR #356](https://github.com/apollostack/apollo-client/pull/356/files), [Issue #354](https://github.com/apollostack/apollo-client/issues/354) [Issue #355](https://github.com/apollostack/apollo-client/issues/355).
- Add a stack trace to `ApolloError`. [PR #445](https://github.com/apollostack/apollo-client/pull/445) and [Issue #434](https://github.com/apollostack/apollo-client/issues/434).
- Fixed an extra log of errors on `query` calls. [PR #445](https://github.com/apollostack/apollo-client/pull/445) and [Issue #423](https://github.com/apollostack/apollo-client/issues/423).
- Fix repeat calls to a query that includes fragments [PR #447](https://github.com/apollostack/apollo-client/pull/447).
- GraphQL errors on mutation results now result in a rejected promise and are no longer a part of returned results. [PR #465](https://github.com/apollostack/apollo-client/pull/465) and [Issue #458](https://github.com/apollostack/apollo-client/issues/458).
- Don't add fields to root mutations and root queries [PR #463](https://github.com/apollostack/apollo-client/pull/463) and [Issue #413](https://github.com/apollostack/apollo-client/issues/413).

### v0.4.7

- Added flattening of fragments within `createFragment`. [PR #437](https://github.com/apollostack/apollo-client/pull/437) and [Issue #421](https://github.com/apollostack/apollo-client/issues/421).

### v0.4.6

- Integrated the scheduler so that polling queries on the same polling interval are batched together. [PR #403](https://github.com/apollostack/apollo-client/pull/403) and [Issue #401](https://github.com/apollostack/apollo-client/issues/401).
- Fixed a bug where fetching a query without an id and then later with an id resulted in an orphaned node within the store. [Issue #344](https://github.com/apollostack/apollo-client/issues/344) and [PR #389](https://github.com/apollostack/apollo-client/pull/389).
- Fix typings for some refactored types, `ObservableQuery` and `WatchQueryOptions`. [PR #428](https://github.com/apollostack/apollo-client/pull/428)

### v0.4.5

- Fix the issue of using query transformers with mutations containing `optimisticResponse` or `updateQueries`. [PR #426](https://github.com/apollostack/apollo-client/pull/426).

### v0.4.4

- Make sure query transformers are also applied to named fragments, and new methods that allow transforming query document with multiple query transformers. [Issue #373](https://github.com/apollostack/apollo-client/issues/373) [PR #412](https://github.com/apollostack/apollo-client/pull/412)

### v0.4.3

- Introduce a new (preferable) way to express how the mutation result should be incorporated into the store and update watched queries results: `updateQueries`. [PR #404](https://github.com/apollostack/apollo-client/pull/404).
- Writing query results to store no longer creates new objects (and new references) in cases when the new value is identical to the old value in the store.

### v0.4.2

- Added the `batchInterval` option to ApolloClient that allows you to specify the width of the batching interval as per your app's needs. [Issue #394](https://github.com/apollostack/apollo-client/issues/394) and [PR #395](https://github.com/apollostack/apollo-client/pull/395).
- Stringify `storeObj` for error message in `diffFieldAgainstStore`.
- Fix map function returning `undefined` in `removeRefsFromStoreObj`. [PR #393](https://github.com/apollostack/apollo-client/pull/393)
- Added deep result comparison so that observers are only fired when the data associated with a particular query changes. This change eliminates unnecessary re-renders and improves UI performance. [PR #402](https://github.com/apollostack/apollo-client/pull/402) and [Issue #400](https://github.com/apollostack/apollo-client/issues/400).
- Added a "noFetch" option to WatchQueryOptions that only returns available data from the local store (even it is incomplete). The `ObservableQuery` returned from calling `watchQuery` now has `options`, `queryManager`, and `queryId`. The `queryId` can be used to read directly from the state of `apollo.queries`. [Issue #225](https://github.com/apollostack/apollo-client/issues/225), [Issue #342](https://github.com/apollostack/apollo-client/issues/342), and [PR #385](https://github.com/apollostack/apollo-client/pull/385).

### v0.4.1

- Allow `client.mutate` to accept an `optimisticResponse` argument to update the cache immediately, then after the server responds replace the `optimisticResponse` with the real response. [Issue #287](https://github.com/apollostack/apollo-client/issues/287) [PR #336](https://github.com/apollostack/apollo-client/pull/336)

### v0.4.0

This release has a minor version bump, which means npm will not automatically update to this version. Consider the list of breaking changes below, then upgrade and update your app correspondingly.

- **Breaking change** Remove backcompat shim for `import ... from 'apollo-client/gql'`. Instead, use the `graphql-tag` package as recommended in the docs and official examples. [Issue #324](https://github.com/apollostack/apollo-client/issues/324) [PR #387](https://github.com/apollostack/apollo-client/pull/387)

- **Breaking change** Moved refetch(), startPolling(), and stopPolling() methods from QuerySubscription to ObservableQuery. This shouldn't affect anyone using `react-apollo`, but if you were calling those methods on the subscription directly, you need to call them on the query handle/observable instead. The benefit of this is that developers that want to use RxJS for their observable handling can now have access to these methods. [Issue #194] (https://github.com/apollostack/apollo-client/issues/194) and [PR #362] (https://github.com/apollostack/apollo-client/pull/362)
- **Breaking change** Unified error handling for GraphQL errors and network errors. Both now result in rejected promises and passed as errors on observables through a new `ApolloError` type. This is a significant departure from the previous method of error handling which passed GraphQL errors in resolvers and `next` methods on subscriptions. [PR #352](https://github.com/apollostack/apollo-client/pull/352)

### v0.3.30

- Don't throw on unknown directives, instead just pass them through. This can open the door to implementing `@live`, `@defer`, and `@stream`, if coupled with some changes in the network layer. [PR #372](https://github.com/apollostack/apollo-client/pull/372)

### v0.3.29

- Made sure that query merging is only applied when we have more than one query in the batcher's queue [Issue #308](https://github.com/apollostack/apollo-client/issues/308) and [PR #369](https://github.com/apollostack/apollo-client/pull/369).

### v0.3.28

- Added missing export for the `addQueryMerging` method defined in the docs [here](http://docs.apollostack.com/apollo-client/network.html#addQueryMerging). [PR #364](https://github.com/apollostack/apollo-client/pull/364) and [Issue #363](https://github.com/apollostack/apollo-client/issues/363).
- Made sure `diffSelectionSetAgainstStore` will return any available data from the local cache if `throwOnMissingField` is `false`, even if some fields in the query are missing. This also means that the `returnPartialData` option of `watchQuery` will return partial data if some fields are missing in the cache, rather than an empty object. [Issue #359](https://github.com/apollostack/apollo-client/issues/359) and [PR #360](https://github.com/apollostack/apollo-client/pull/360).

### v0.3.27

- Removed dependency on `graphql` npm package, which was causing compilation errors in the React Native bundler. Issues [#261](https://github.com/apollostack/apollo-client/issues/261) [#163](https://github.com/apollostack/apollo-client/issues/163), [PR #357](https://github.com/apollostack/apollo-client/pull/357)
- Added support for query composition through fragments [Issue #338](https://github.com/apollostack/apollo-client/issues/338) and [PR #343](https://github.com/apollostack/apollo-client/pull/343)

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
