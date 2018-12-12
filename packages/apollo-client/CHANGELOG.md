# CHANGELOG

----

**NOTE:** This changelog is no longer maintained. Changes are now tracked in
the top level [`CHANGELOG.md`](https://github.com/apollographql/apollo-client/blob/master/CHANGELOG.md).

----

### vNext

- Corrected `ApolloClient.queryManager` typing as it may be undefined.
  [PR #3661](https://github.com/apollographql/apollo-client/pull/3661)
- Updated `graphql` `peerDependencies` to handle 14.x versions.  
  [PR #3598](https://github.com/apollographql/apollo-client/pull/3598)
- Document `setVariables` internal API status.
  [PR #3692](https://github.com/apollographql/apollo-client/pull/3692)

### 2.3.5

- Internal code formatting updates.
  [PR #3574](https://github.com/apollographql/apollo-client/pull/3574)

### 2.3.4

- Export the `QueryOptions` interface, to make sure it can be used by other
  projects (like `apollo-angular`).
- Fixed an issue caused by typescript changes to the constructor
  `defaultOptions` param, that prevented `query` defaults from passing type
  checks.
  [Issue #3583](https://github.com/apollographql/apollo-client/issues/3583)
  [PR #3585](https://github.com/apollographql/apollo-client/pull/3585)

### 2.3.3

- Typescript improvements. Made observable query parameterized on data and
  variables: `ObservableQuery<TData, TVariables>`
  [PR#3140](https://github.com/apollographql/apollo-client/pull/3140)
- Added optional generics to cache manipulation methods (typescript).
  [PR #3541](https://github.com/apollographql/apollo-client/pull/3541)
- Typescript improvements. Created a new `QueryOptions` interface that
  is now used by `ApolloClient.query` options, instead of the previous
  `WatchQueryOptions` interface. This helps reduce confusion (especially
  in the docs) that made it look like `ApolloClient.query` accepted
  `ApolloClient.watchQuery` only options, like `pollingInterval`.
  [Issue #3395](https://github.com/apollographql/apollo-client/issues/3395)
  [PR #3569](https://github.com/apollographql/apollo-client/pull/3569)

### 2.3.2

- Fix SSR and `cache-and-network` fetch policy
  [Issue #2119](https://github.com/apollographql/apollo-client/issues/2119)
  [PR #3372](https://github.com/apollographql/apollo-client/pull/3372)
- Fixed an issue where the `updateQuery` method passed to
  `ObservableQuery.fetchMore` was receiving the original query variables,
  instead of the new variables that it used to fetch more data.
  [Issue #2499](https://github.com/apollographql/apollo-client/issues/2499)
  [PR #3500](https://github.com/apollographql/apollo-client/pull/3500)
- Fixed an issue involving `Object.setPrototypeOf()` not working on JSC
  (Android), by instead setting the `prototype` of `this` manually.
  [Issue #3236](https://github.com/apollographql/apollo-client/issues/3236)
  [PR #3306](https://github.com/apollographql/apollo-client/pull/3306)
- Added safeguards to make sure `QueryStore.initQuery` and
  `QueryStore.markQueryResult` don't try to set the network status of a
  `fetchMoreForQueryId` query, if it does not exist in the store. This was
  happening when a query component was unmounted while a `fetchMore` was still
  in flight.
  [Issue #3345](https://github.com/apollographql/apollo-client/issues/3345)
  [Issue #3466](https://github.com/apollographql/apollo-client/issues/3466)
  [PR #3367](https://github.com/apollographql/apollo-client/pull/3367)
  [PR #3469](https://github.com/apollographql/apollo-client/pull/3469)

### 2.3.1

- Not documented

### 2.3.0
- fixed edge case bug of changing fetchPolicies right after resetStore with no variables present
- Various optimizations for cache read performance
  [#3300](https://github.com/apollographql/apollo-client/pull/3300)

### 2.2.8
- Added the graphQLResultHasError in QueryManager.ts to check not only if result.errors is null, but also empty.
- Errors occurring during fetchMore no longer errors out the original query [PR#2906](https://github.com/apollographql/apollo-client/pull/2906)
- Map coverage to original source

### 2.2.4
- Added `getCacheKey` function to the link context for use in state-link [PR#2998](https://github.com/apollographql/apollo-client/pull/2998)
- Fix `no-cache` fetch policy so it returns data [PR#3102](https://github.com/apollographql/apollo-client/pull/3102)
- Fix Memory Leak in Query Manager [PR#3119](https://github.com/apollographql/apollo-client/pull/3119)
- Pass non-optimistic query to `subscribeToMore` updateQuery
[PR#3068](https://github.com/apollographql/apollo-client/pull/3068)
- onResetStore callbacks occur before refetching Observable Queries[PR#3010](https://github.com/apollographql/apollo-client/pull/3010)
- Error message for in flight queries during `resetStore` includes link completion note[PR#3010](https://github.com/apollographql/apollo-client/pull/3010)
- `ApolloError` can now be checked with `instanceof` operator
- Fix navigator being undefined on React Native [PR##3164](https://github.com/apollographql/apollo-client/pull/3164)
- Remove spread of variables preventing issues with removing keys [#3081](https://github.com/apollographql/apollo-client/pull/3081)

### 2.2.3
- dependency updates
- Provide data when errorPolicy is set "all"

### 2.2.2
- Fixed potential race condition in mutations
- Add new fetchPolicy called 'no-cache' to bypass reading from or saving to the cache when making a query

### 2.2.1
- Allow optional parameter to include queries in standby mode when refetching observed queries [PR#2804](https://github.com/apollographql/apollo-client/pull/2804)

### 2.2.0
- include `optimisticResponse` in the context passed to apollo-link for mutations [PR#2704](https://github.com/apollographql/apollo-client/pull/2704)
- Add cache.writeData to base cache type & DataProxy [PR#2818](https://github.com/apollographql/apollo-client/pull/2818)
- Error when invalid `cache-and-network` is provided as `query.fetchPolicy` within `defaultOptions`
- add `onResetStore` method to the client to register callbacks after `client.resetStore` is called [PR#2812](https://github.com/apollographql/apollo-client/pull/2812)

### 2.1.1
- fix eslint usage by fixing jsnext:main path

### 2.1.0
- Expose the cache methods `restore` and `extract` directly on ApolloClient  [PR#2615](https://github.com/apollographql/apollo-client/pull/2615)
- Expose a method to refetch all observed queries without resetting the store [PR#2625](https://github.com/apollographql/apollo-client/pull/2625)

### 2.0.3
- Revert returning `data` directly in subscriptions, now returns `data` and `errors`
- Include passed context in the context for mutations
- Remove locked dep on apollo-link and apollo-link-dedup
- Fix bug where setting options didn't adjust pollInterval correctly [PR#2573](https://github.com/apollographql/apollo-client/pull/2573)
- Fix issue where write(Fragment|Query) didn't rerender store [PR#2574](https://github.com/apollographql/apollo-client/pull/2574)
- Remove uneeded code causing equality failures [PR#2574](https://github.com/apollographql/apollo-client/pull/2574)
- Potentially fix missing data when rerendering from cache bug in RA [PR#2574](https://github.com/apollographql/apollo-client/pull/2574)
- Preserve referential equality when calling currentResult if possible
- Include `null` in types of cache reading results [PR#2572](https://github.com/apollographql/apollo-client/pull/2572)

### 2.0.2
- Fixed mutation result error checking for empty array
- Fix accessing undefined window when forcing connectToDevTools to true
- Fix GraphQL errors not being attached to currentResult if no policy passed

### 2.0.1
- remove errant console

### 2.0.0
- Make sure context + cache is on links for mutations
- Improved error for upgrading to 2.0
- Fix bug with mutations not updating watchedQueries where variables don't change
- Define and expose `ApolloClientOptions`, Type of an object that represents ApolloClient's constructor argument.
- Expose `ApolloCurrentResult`
- Throw an error if cache or data are not supplied to the `ApolloClient` constructor
- Add `graphql` as a dev dependency
- Fix bug in not cleaning up after individual query operation
- Return data directly in subscriptions instead of data and errors
- Support experimental transformForLink for caches

### 2.0.0-rc.3
- Only include `data` on subscriptionData when using `subscribeToMore`

### 2.0.0-rc.2
- Support devTools with `_renderRaw` to execute link directly (bypass store)

### 2.0.0-rc.1
- Fix bug where changed variables with different cache data didn't rerender properly

### 2.0.0-beta.8
- Move graphql to peerDependency
- Ensure network errors don't cause unhandled rejections on polled queries
- Improve performance of mutation broadcasts
- Remove warning on refetching unfetched queries after a mutation

### 2.0.0-beta.6
- Support conditional refetches for mutations
- Ensure network errors don't cause unhandled rejections on cache-and-network policies
- Added the cache to the client for easier SSR
- Strip connection directive out before reqest sent to link

### 2.0.0-beta.5
- Fix argument for FragmentMatcher

### 2.0.0-beta.4 (alpha.2 -> beta.4)
- Update to latest stable link package
- Fix error handling when recycling observables
- Fix currentResult when errorPolicy is set to 'all'
- Fix default ErrorPolicy in QueryManager#mutate [PR #2194](https://github.com/apollographql/apollo-client/pull/2194)
- Fix Date handling in isEqual [PR #2131](https://github.com/apollographql/apollo-client/pull/2131)
- Fix errors when `isEqual` called with object having no prototype [PR #2138](https://github.com/apollographql/apollo-client/pull/2138)
- Support @live and @defer queries via watchQuery
- Refactor query tracking internally to QueryManager
- Remove internal typename usage in favor of cache transformers [BREAKING]
- Introduce new ErrorPolicy to allow for errors from execution results to trigger observers
- Support multiple results from the network layer (links)
- Remove internal Observable implemenation [BREAKING]. `next` is no longer called after `error` or `complete` is fired
- Convert tests to use Jest
- Replace core utils with apollo-utilities
- Cleanup InMemoryCache to remove unused methods and minimize cache reads in QueryManager's getCurrentResult [PR 2035](https://github.com/apollographql/apollo-client/pull/2035)
- When cache implementations broadcast invalidations, they also provide the latest data for the invalidated query to minimize reads inside the QueryManager [PR 2031](https://github.com/apollographql/apollo-client/pull/2031)
- Move abstract cache into its own module [PR #2019](https://github.com/apollographql/apollo-client/pull/2019)
- Convert network stack to links [PR #1993](https://github.com/apollographql/apollo-client/pull/1993)
- Move to using lerna for the repo [PR #1984](https://github.com/apollographql/apollo-client/pull/1984)
- Remove dependency on Redux as well as store reducers (update and updateQueries are still supported and should be used instead) [PR 1949](https://github.com/apollographql/apollo-client/pull/1949)
- Introduce a new Cache API that makes it possible to plug in custom cache implementations into the client [PR 1921](https://github.com/apollographql/apollo-client/pull/1921)
- Migrated the cache away from Redux in preparation for the generic store API [PR 1907](https://github.com/apollographql/apollo-client/pull/1907)

### 1.9.2
- Fix FetchMoreQueryOptions and IntrospectionResultData flow annotations [PR #2034](https://github.com/apollographql/apollo-client/pull/2034)
- Fix referential equality bug for queries with custom resolvers [PR #2053](https://github.com/apollographql/apollo-client/pull/2053)

### 1.9.1
- Add support for subscriptions with Apollo Link network stack [PR #1992](https://github.com/apollographql/apollo-client/pull/1992)
- fixed `resolved` scoping issue for multiple queries in flight with Apollo Link [PR #2002](https://github.com/apollographql/apollo-client/pull/2002)

### 1.9.0
- Move to `apollo-link-core` from `apollo-link` to reduce bundle size [PR #1955](https://github.com/apollographql/apollo-client/pull/1955)
- Document ApolloClient.prototype.subscribe [PR #1932](https://github.com/apollographql/apollo-client/pull/1932)
- Fix NetworkMiddleware flow typings [PR #1937](https://github.com/apollographql/apollo-client/pull/1937)
- Fix use of @connection directives when using batching [PR #1961](https://github.com/apollographql/apollo-client/pull/1961)
- Allow data fetch after a NetworkError when polling

### 1.9.0-1
- Adds apollo-link network interface support [PR #1918](https://github.com/apollographql/apollo-client/pull/1918)
- Fix issue with fetchMore not merging results correctly when the @connection directive is used [PR #1915](https://github.com/apollographql/apollo-client/pull/1915)
- added prettier to manage formatting of project [PR #1904](https://github.com/apollographql/apollo-client/pull/1904)
- Replace use of `Object` with `Record<string, any>` in mutation types
- Fix loss of referential equality for results returned by `currentResults()` before an ObservableQuery is setup [PR #1927](https://github.com/apollographql/apollo-client/pull/1927)

### 1.9.0-0
- Remove query tracking from the Redux store. Query status tracking is now handled outside of Redux in the QueryStore class. [PR #1859](https://github.com/apollographql/apollo-client/pull/1859)
- Remove mutation tracking from the Redux store. Mutation status tracking is now handled outside of Redux in the MutationStore class. [PR #1846](https://github.com/apollographql/apollo-client/pull/1846)

### 1.8.1
- Use generic types for store updating functions in mutations [PR #1882](https://github.com/apollographql/apollo-client/pull/1882)
- Update to TypeScript 2.4.1 [PR #1892](https://github.com/apollographql/apollo-client/pull/1892)

### 1.8.0
- Add the `filter` argument to the `@connection` directive so that custom store keys can include query arguments [PR #1862](https://github.com/apollographql/apollo-client/pull/1862)
- Add support for flow typecheck to work out of the box (without any configuration) [PR #1820](https://github.com/apollographql/apollo-client/pull/1820)
- Remove the dependency on the query and mutation store from the data reducer. Apollo actions sent to Redux now contain additional information that was originally pulled from the query and mutation stores [PR #1845](https://github.com/apollographql/apollo-client/pull/1845)
- Fix: Avoiding reprocessing of identical data when writing to the store [PR #1675](https://github.com/apollographql/apollo-client/pull/1675)

### 1.7.0
- Add support for network interfaces that return observables [PR #1840](https://github.com/apollographql/apollo-client/pull/1840)

### 1.6.1
- Pin @types/node to 8.0.2 to avoid breaking type update

### 1.6.0
- the `@connection(key: ...)` directive can now be used to specify the key to use
for the Apollo store and is removed by default when sending queries to the server [PR #1801](https://github.com/apollographql/apollo-client/pull/1801)

### 1.5.0
- `batchInterval` now has a default value of 10 ms [PR #1793](https://github.com/apollographql/apollo-client/pull/1793)
- Added `batchMax` to allow you to limit the amount of queries in one batch. [PR #1659](https://github.com/apollographql/apollo-client/pull/1659)

### 1.4.2
- Improved error messages for writeToStore, readFragment and writeFragment [PR #1766](https://github.com/apollographql/apollo-client/pull/1766), [PR #1722](https://github.com/apollographql/apollo-client/pull/1722)

### 1.4.1
- Fix: broken edge case when setting up fragment matching with Typescript by fixing types on `IntrospectionResultData` [PR #1763](https://github.com/apollographql/apollo-client/pull/1763)
- Fix: getOperationName now returns null when no operation name can be found in the document [PR #1769](https://github.com/apollographql/apollo-client/pull/1769)

### v1.4.0
- Feature: Add `operationName` to Redux actions where possible [PR #1676](https://github.com/apollographql/apollo-client/pull/1676)
- Feature: Allow an observer to not be created when setting variables[PR #1752](https://github.com/apollographql/apollo-client/pull/1752)
- Feature: Added support for flow typechecking [PR #1688](https://github.com/apollographql/apollo-client/pull/1688)

### v1.3.0
- Make ApolloClient.resetStore() and QueryManager.resetStore() return a promise instead of void [PR #1674](https://github.com/apollographql/apollo-client/pull/1674)
- Fix bug that caused errors in `writeToStore` to be rethrown as uncaught errors [PR #1673](https://github.com/apollographql/apollo-client/pull/1673)
- Feature: Pass a function to `optimisticResponse` and it will be called with the `variables` passed to the mutation [PR #1720](https://github.com/apollographql/apollo-client/pull/1720)

### 1.2.2
- Fix: Remove race condition in queryListenerFromObserver [PR #1670](https://github.com/apollographql/apollo-client/pull/1670)
- Feature: Expose `dataIdFromObject` in addition to `dataId` [PR #1663](https://github.com/apollographql/apollo-client/pull/1663)

### 1.2.1
- Fix: Ensure polling queries do not poll during SSR [#1664](https://github.com/apollographql/apollo-client/pull/1664)
- Fix: Ensure setVariables correctly sets options.variables [#1662](https://github.com/apollographql/apollo-client/pull/1662)
- Fix bug that caused results with null items in array to become empty on second read [#1661](https://github.com/apollographql/apollo-client/pull/1661)

### 1.2.0
- Feature: Warn before writing to store if result shape does not match query [#1638](https://github.com/apollographql/apollo-client/pull/1638)
- Fix: Replace more usage of Object.assign with util.assign to make it work in IE, previous fix was not complete [PR #1648](https://github.com/apollographql/apollo-client/pull/1648)

### 1.1.2
- Feature+Fix: Introduce "standby" fetchPolicy to mark queries that are not currently active, but should be available for refetchQueries and updateQueries [PR #1636](https://github.com/apollographql/apollo-client/pull/1636)
- Feature: Print a warning when heuristically matching fragments on interface/union [PR #1635](https://github.com/apollographql/apollo-client/pull/1635)
- Fix: Replace usage of Object.assign with util.assign to make it work in IE, make util.assign work with undefined and null sources as Object.assign does [PR #1643](https://github.com/apollographql/apollo-client/pull/1643)

### 1.1.1
- Fix: Remove ability to set default fetchPolicy, which broke polling queries [PR #1630](https://github.com/apollographql/apollo-client/pull/1630)

### 1.1.0
- Feature: support default values for query variables [PR #1492](https://github.com/apollographql/apollo-client/pull/1492)
- Fix: Pass http json parsing error to network interface afterware [PR #1596](https://github.com/apollographql/apollo-client/pull/1596)
- Feature: Add ability to set default fetchPolicy [PR #1597](https://github.com/apollographql/apollo-client/pull/1597)

### 1.0.4
- Fix: query subscription is not skipped when there is a successful query after an error, even if data is the same as before the error occured. [PR #1601] (https://github.com/apollographql/apollo-client/pull/1601)
- Fix: ObservableQuery.refetch() returns a rejected Promise instead of throwing an Error when fetchPolicy === 'cache-only' [PR #1592](https://github.com/apollographql/apollo-client/pull/1592)
- Fix: Remove usage of Array.findIndex (not supported by IE) [PR #1585](https://github.com/apollographql/apollo-client/pull/1585)

### 1.0.3
- Fix: Remove usage of String.endsWith (not supported by IE) [PR #1583](https://github.com/apollographql/apollo-client/pull/1583)
- Make reducerError contain information about which query caused it [PR #1538](https://github.com/apollographql/apollo-client/pull/1538)

### 1.0.2
- Fix bug that caused reducer updates to fail because typename was not added automatically [PR #1540](https://github.com/apollographql/apollo-client/pull/1540)

### 1.0.1
- Fix bug that caused updateQueries to fail when fragments were present in query [#1527](https://github.com/apollographql/apollo-client/issues/1527)

### 1.0.0 and 1.0.0-rc.9
- Make imperative store operations respect addTypename [PR #1515](https://github.com/apollographql/apollo-client/issues/1515)
- Fix bug that broke ObservableQuery.getCurrentResult for queries that used fragments [PR #1514](https://github.com/apollographql/apollo-client/issues/1514)


### 1.0.0-rc.8
- Make `QueryBatcher` more efficient and avoid `setInterval` leakage [PR #1498](https://github.com/apollographql/apollo-client/pull/1498).
- Remove dependency on `graphql-tag/printer` per [graphql-tag#54](https://github.com/apollographql/graphql-tag/issues/54)

### 1.0.0-rc.7
- Fix: `fetchPolicy: cache-and-network` queries now dispatch `APOLLO_QUERY_RESULT_CLIENT` [PR #1463](https://github.com/apollographql/apollo-client/pull/1463)
- Fix: query deduplication no longer causes query errors to prevent subsequent successful execution of the same query  [PR #1481](https://github.com/apollographql/apollo-client/pull/1481)
- Breaking: change default of notifyOnNetworkStatusChange back to false [PR #1482](https://github.com/apollographql/apollo-client/pull/1482)
- Feature: add fragmentMatcher option to client and implement IntrospectionFragmentMatcher [PR #1483](https://github.com/apollographql/apollo-client/pull/1483)

### 1.0.0-rc.6
- Feature: Default selector for `dataIdFromObject` that tries `id` and falls back to `_id` to reduce configuration requirements whenever `__typename` is present.
- Add `HTTPBatchedNetworkInterface` as an index export to make it easier
to subclass externally, consistent with `HTTPFetchNetworkInterface`. [PR #1446](https://github.com/apollographql/apollo-client/pull/1446)
- Make `updateQuery` option of `subscribeToMore` optional [PR #1455](https://github.com/apollographql/apollo-client/pull/1455)
- Fix: Use custom resolvers in readQuery and readFragment functions [PR #1434](https://github.com/apollographql/apollo-client/pull/1434)
- Print suggestion to use devtools in development mode [PR #1466](https://github.com/apollographql/apollo-client/pull/1466)

### 1.0.0-rc.5
- Fix: Revert PR that caused uncaught promise rejections [PR #1133](https://github.com/apollographql/apollo-client/pull/1133)


### 1.0.0-rc.4
- Fix: Update TypeScript Middleware and Afterware interfaces to include a datatype for 'this' in apply function. [PR #1372](https://github.com/apollographql/apollo-client/pull/1372)
- Breaking: Remove data property from fetchMore result [PR #1416](https://github.com/apollographql/apollo-client/pull/1416)
- Fix: rollback optimistic response before ApolloError rejected in `QueryManager#mutate` [PR #1398](https://github.com/apollographql/apollo-client/pull/1398)
- console.warn() when an exception is encountered in a result reducer [PR #1383](https://github.com/apollographql/apollo-client/pull/1383)

### 1.0.0-rc.3
deprecated (wrong build)

### 1.0.0-rc.2
- throw error if deprecated options are being used [PR #1396](https://github.com/apollographql/apollo-client/pull/1396)

### 1.0.0-rc.1
- Fix (possibly breaking): Invoke afterware even on requests that error [PR #1351](https://github.com/apollographql/apollo-client/pull/1351)
- Breaking: change default of notifyOnNetworkStatusChange to true [PR #1362](https://github.com/apollographql/apollo-client/pull/1362)
- Breaking: change default of queryDeduplication to true [PR #1362](https://github.com/apollographql/apollo-client/pull/1362)
- Breaking: remove deprecated reduxRootKey [PR #1362](https://github.com/apollographql/apollo-client/pull/1362)
- Fix: make sure maybeDeepFreeze is called on results returned from setVariables and refetch [PR #1362](https://github.com/apollographql/apollo-client/pull/1362)
- Fix: use setTimeout to throw uncaught errors in observer.next and observer.error[PR #1367](https://github.com/apollographql/apollo-client/pull/1367)
- Breaking: Remove returnPartialData option [PR #1370](https://github.com/apollographql/apollo-client/pull/1370)
- Breaking: Implement fetchPolicy to replace noFetch and forceFetch [PR #1371](https://github.com/apollographql/apollo-client/pull/1371)


### 0.10.1
- Address deprecation warnings coming from `graphql-tag` [graphql-tag#54](https://github.com/apollographql/graphql-tag/issues/54)
- Do not stringify error stack traces [PR #1347](https://github.com/apollographql/apollo-client/pull/1347)

### 0.10.0
- BREAKING: Run middleware and afterware only once per batched request [PR #1285](https://github.com/apollographql/apollo-client/pull/1285)
- Add direct cache manipulation read and write methods to provide the user the power to interact with Apollo’s GraphQL data representation outside of mutations. [PR #1310](https://github.com/apollographql/apollo-client/pull/1310)
- Clear pollInterval in `ObservableQuery#stopPolling` so that resubscriptions don't start polling again [PR #1328](https://github.com/apollographql/apollo-client/pull/1328)
- Update dependencies (Typescript 2.2.1, node typings, etc.) [PR #1332](https://github.com/apollographql/apollo-client/pull/1332)
- Fix bug that caused: `error: Cannot read property 'data' of undefined`, when no previous result was available [PR #1339](https://github.com/apollographql/apollo-client/pull/1339).
- Add 'addTypenameToDocument' to root export for usage in custom network interfaces and testing [PR #1341](https://github.com/apollographql/apollo-client/pull/1341)

### 0.9.0
- Prefer stale data over partial data in cases where a user would previously get an error. [PR #1306](https://github.com/apollographql/apollo-client/pull/1306)
- Update TypeScript `MutationOptions` definition with the new object type available in `refetchQueries`. [PR #1315](https://github.com/apollographql/apollo-client/pull/1315)
- Add `fetchMore` network status to enable loading information for `fetchMore` queries. [PR #1305](https://github.com/apollographql/apollo-client/pull/1305)

### 0.8.7
- Ensure batching network interface passes through extra parameters in order to support persisted queries [PR #1302](https://github.com/apollographql/apollo-client/pull/1302/files)

### 0.8.6
- Fix bug that caused `refetch` to not refetch in some cases [PR #1264](https://github.com/apollographql/apollo-client/pull/1264)

### 0.8.5
- Fix crash if resetStore() or getInitialState() called prior to query/mutation.  [PR #1286](https://github.com/apollostack/apollo-client/pull/1286).

### 0.8.4
- Fix afterware to support retrying requests [PR #1274](https://github.com/apollostack/apollo-client/pull/1274).

### 0.8.3
- Fix bug that caused query reducers to always be called with initial variables. [PR #1270](https://github.com/apollostack/apollo-client/pull/1270).
- Added benchmarks and benchmarking utilities built on top of [benchmark.js](https://benchmarkjs.com). [PR #1159](https://github.com/apollostack/apollo-client/pull/1159).

### 0.8.2
- Removed dependency on Node.js typings. [PR #1248](https://github.com/apollostack/apollo-client/pull/1248)
- Remove orphaned promise that was causing a Bluebird error. [PR #1256](https://github.com/apollographql/apollo-client/pull/1256)
- End code flow on promise rejection in `mutate` implementation. [PR #1259](https://github.com/apollographql/apollo-client/pull/1259)

### 0.8.1
- Allow refetching with query documents after mutation. [PR #1234](https://github.com/apollostack/apollo-client/pull/1234)
- Enable TypeScript strict null checking in source code. [PR #1221](https://github.com/apollostack/apollo-client/pull/1221)

### 0.8.0
- Allow optional mutation arguments. [PR #1174](https://github.com/apollostack/apollo-client/pull/1174)
- Fix bug where there could be store inconsistencies for two dependent optimistic updates [PR #1144](https://github.com/apollostack/apollo-client/pull/1144)
- expose partial in ObservableQuery#currentResult [PR #1097](https://github.com/apollostack/apollo-client/pull/1097)
- Calculate `loading` from `networkStatus`. [PR #1202](https://github.com/apollostack/apollo-client/pull/1202)
- Fix typings error with `strictNullChecks` [PR #1188](https://github.com/apollostack/apollo-client/pull/1188)
- Add IResponse to NetworkErrors [PR #1199](https://github.com/apollostack/apollo-client/issues/1199)
- Gracefully handle `null` GraphQL errors. [PR #1208](https://github.com/apollostack/apollo-client/pull/1208)
- *Breaking:* Remove undocumented `resultBehaviors` feature. [PR #1173](https://github.com/apollostack/apollo-client/pull/1173)

### 0.7.3
- *Fixed breaking change:* readQueryFromStore was incomptibale with Typescript 2.0 compiler. [PR #1171](https://github.com/apollostack/apollo-client/pull/1171)

### 0.7.2
Re-release of 0.7.1 with proper internal directory structure

### 0.7.1
- *Undo breaking change:* Add whatwg-fetch polyfill (most likely only until version 1.0) [PR #1155](https://github.com/apollostack/apollo-client/pull/1155)

### 0.7.0
- Deprecate "resultTransformer" [PR #1095](https://github.com/apollostack/apollo-client/pull/1095)
- Deep freeze results in development and test mode [PR #1095](https://github.com/apollostack/apollo-client/pull/1095)
- *Breaking:* Use generic types for query and mutation [PR #914](https://github.com/apollostack/apollo-client/pull/914)
- Support AMD [PR #1069](https://github.com/apollostack/apollo-client/pull/1069)
- Support ES6 Modules and tree-shaking (`module`, `jsnext:main`) [PR #1069](https://github.com/apollostack/apollo-client/pull/1069)
- *Breaking:* Replace `@types/redux` with official typescript definitions [PR #1069](https://github.com/apollostack/apollo-client/pull/1069)
- *Breaking:* Remove fragment option from query, watchQuery etc. [PR #1096](https://github.com/apollostack/apollo-client/pull/1096)
- Broadcast new store state only when Apollo state was affected by an action [PR #1118](https://github.com/apollostack/apollo-client/pull/1118)
- Remove lodash as a production dependency [PR #1122](https://github.com/apollostack/apollo-client/pull/1122)
- Breaking: Minor fix to write to `ROOT_SUBSCRIPTION` ID in the store for subscription results. [PR #1122](https://github.com/apollostack/apollo-client/pull/1127)
- *Breaking:* Remove `whatwg-fetch` polyfill dependency and instead warn when a global `fetch` implementation is not found. [PR #1134](https://github.com/apollostack/apollo-client/pull/1134)
- Child objects returned from `watchQuery` may now be referentially equal (so `a === b`) to previous objects in the same position if nothing changed in the store. This allows for a better UI integration experience when determining what needs to rerender. [PR #1136](https://github.com/apollostack/apollo-client/pull/1136)

### 0.6.0
- *Breaking:* Switch to `@types/graphql` instead of `typed-graphql` for typings. [PR 1041](https://github.com/apollostack/apollo-client/pull/1041) [PR #934](https://github.com/apollostack/apollo-client/issues/934)

### 0.5.26
- Add variables to MutationResultAction [PR #1106](https://github.com/apollostack/apollo-client/pull/1106)
- Fix incorrect network status after first refetch [PR #1105](https://github.com/apollostack/apollo-client/pull/1105)

### 0.5.25
- Pass variables into result reducers [PR #1088](https://github.com/apollostack/apollo-client/pull/1088)

### 0.5.24
- Add option to deduplicate in-flight queries  [PR #1070](https://github.com/apollostack/apollo-client/pull/1070)

### 0.5.23
- Revert back to using `whatwg-fetch` because `isomorphic-fetch` does not work in react native  [PR #1058](https://github.com/apollostack/apollo-client/pull/1058)

### 0.5.22
- Fix bug that caused updateQuery and reducers to run on stopped queries [PR #1054](https://github.com/apollostack/apollo-client/pull/1054)
- Ensure transporters are using `isomorphic-fetch` instead of `whatwg-fetch` for universal compatibility [PR #1018](https://github.com/apollostack/apollo-client/pull/1018)

### 0.5.21

- Include a `version` field on every `ApolloClient` instance that represents the version of the 'apollo-client' package used to create it. [PR #1038](https://github.com/apollostack/apollo-client/pull/1038)

### 0.5.20

- Attach to `window` for devtools if not in production, so that improperly configured environments do get the dev tools. [PR #1037](https://github.com/apollostack/apollo-client/pull/1037)

### 0.5.19
- Make sure stopped queries are not refetched on store reset [PR #960](https://github.com/apollostack/apollo-client/pull/960)

### 0.5.18
- Make sure `APOLLO_QUERY_RESULT_CLIENT` action has a `requestId`, just like `APOLLO_QUERY_RESULT` does, so that it can be associated with the relevant `APOLLO_QUERY_INIT` action.

### 0.5.17
- For devtools hook, report the state _after_ the action, not before. [PR #1023](https://github.com/apollostack/apollo-client/pull/1023)

### 0.5.16
- Make sure Redux devtools enhancer is added last. [PR #1022](https://github.com/apollostack/apollo-client/pull/1022)

### 0.5.15
- Make sure devtools hook added in 0.5.14 also works when the store is initialized by Apollo Client. [PR #1021](https://github.com/apollostack/apollo-client/pull/1021)

### 0.5.14
- Add internal hook for chrome devtools, `__actionHookForDevTools`, to get a log of actions and states. Apollo Client automatically attaches itself to `window.__APOLLO_CLIENT__` when initialized if `process.env.NODE_ENV === 'development'`. This can be forced or disabled by setting the `connectToDevTools` option in the constructor to `true` or `false`. [PR #1017](https://github.com/apollostack/apollo-client/pull/1017)

### 0.5.13
- Replace usages of `Object.assign` with lodash's assign function [PR #1009](https://github.com/apollostack/apollo-client/pull/1009)
- Calls to watchQuery can include metadata, for use with debugging. [PR #1010](https://github.com/apollostack/apollo-client/pull/1010)

### 0.5.12
- Errors thrown in afterwares bubble up [PR #982](https://github.com/apollostack/apollo-client/pull/982)
- Replaced individual lodash packages with original lodash package [PR #997](https://github.com/apollostack/apollo-client/pull/997)

### 0.5.11
- Move typed-graphql and chai typings to optionalDependencies [PR #988](https://github.com/apollostack/apollo-client/pull/988)
- Fix issue with typings that prevented compilation in typescript [PR #986](https://github.com/apollostack/apollo-client/pull/986)

### 0.5.10
- Deprecate usage of fragment option and createFragment function [PR #984](https://github.com/apollostack/apollo-client/pull/984)

### 0.5.9
- Prevent Redux from crashing when an uncaught ApolloError is raised in an Apollo reducer. [PR #874](https://github.com/apollostack/apollo-client/pull/874)
- Catch errors in observer.next and observer.errors callback [PR #980](https://github.com/apollostack/apollo-client/pull/980)

### 0.5.8

- Added `HTTPFetchNetworkInterface` and `NetworkInterface` as index exports to make them easier
to subclass externally. [#969](https://github.com/apollostack/apollo-client/pull/969)

### 0.5.7
- Catch uncaught promise errors in startQuery [#950](https://github.com/apollostack/apollo-client/pull/950)

### 0.5.6
- Refactor polling query logic to fix startPolling and stopPolling [#938](https://github.com/apollostack/apollo-client/pull/938)
- Add convenience method to obtain initial state from SSR [#941](https://github.com/apollostack/apollo-client/pull/941)

### 0.5.5
- Add back missing dependency on lodash.isequal that was mistakenly removed in 0.5.4 [#925](https://github.com/apollostack/apollo-client/pull/925)
- Implement cache redirects with custom resolvers [PR #921](https://github.com/apollostack/apollo-client/pull/921)
- Fix issue that caused `createBatchingNetworkInterface` unable to specify request headers by `opts` or `applyMiddleware`. [PR #922](https://github.com/apollostack/apollo-client/pull/922) [Issue #920](https://github.com/apollostack/apollo-client/issues/920)

### 0.5.4
- Fix a bug that caused apollo-client to catch errors thrown in Observer.next callbacks [PR #910](https://github.com/apollostack/apollo-client/pull/910)
- Make sure only one copy of each fragment is attached to a document [PR #906](https://github.com/apollostack/apollo-client/pull/906)

### 0.5.3
- Change the way IDs of objects in arrays are stored to make them consistent with the rest of the store [PR #901](https://github.com/apollostack/apollo-client/pull/901)

### 0.5.2
- Print a warning if server response is not an array when using transport batching [PR #893](https://github.com/apollostack/apollo-client/pull/893)
- apply addTypename in watchQuery for result reducers [PR #895](https://github.com/apollostack/apollo-client/pull/895)

### 0.5.1
- **new Feature**: Enable chaining of `use` and `useAfter` function calls in network interface. [PR #860](https://github.com/apollostack/apollo-client/pull/860) [Issue #564](https://github.com/apollostack/apollo-client/issues/564)
- Create and expose the `MutationOptions` [PR #866](https://github.com/apollostack/apollo-client/pull/866)
- Expose `SubscriptionOptions` [PR #868](https://github.com/apollostack/apollo-client/pull/868)
- Fix issue with `currentResult` and optimistic responses [Issue #877](https://github.com/apollostack/apollo-client/issues/877)
- Provide an onError callback for subscribeToMore [PR #886](https://github.com/apollostack/apollo-client/issues/886)
- Bind `resetStore` to ApolloClient [PR #882](https://github.com/apollostack/apollo-client/issues/882)
- Fix a bug with `resetStore` that caused existing queries to fail  [PR #885](https://github.com/apollostack/apollo-client/issues/885)

### v0.5.0
- Add a `createdBatchingNetworkInterface` function and export it.
- Add support for fragments to `fetchMore`
- Patch for race condition in broadcastQueries that occasionally crashed the client.

#### v0.5.0-preview.3
- **new Feature**: add networkStatus to ApolloResult, which gives more fine-grained information than the loading boolean. Added notifyOnNetworkStatusChange option to WatchQuery options. [PR #827](https://github.com/apollostack/apollo-client/pull/827)
- Fix a bug with result reducers that caused crashed when queries were updated in loading state.

#### v0.5.0-preview.2
- Make `createNetworkInterface` backwards compatible, but print a deprecation warning if it's called with two arguments. The new way is to pass in an object with `uri` and `opts` properties. [PR #828](https://github.com/apollostack/apollo-client/pull/828) [Issue #806](https://github.com/apollostack/apollo-client/issues/806)
- Prevent store rehydration if queries and mutations are not empty. [PR #814](https://github.com/apollostack/apollo-client/pull/814)
- Fix an issue with `observableQuery.currentResult()` when the query had returned an error.

#### v0.5.0-1 first preview
- **new Feature**: Add fetchMore-style subscribeToMore function which updates a query result based on a subscription. [PR #797](https://github.com/apollostack/apollo-client/pull/797)
- Fix accidental breaking change in updateQueries that was introduced in 0.5.0-0 [PR 801](https://github.com/apollostack/apollo-client/pull/801)

#### v0.5.0-0 first preview

- **new Feature**: Implement query reducers, which run on every query result/ mutation. [PR #766](https://github.com/apollostack/apollo-client/pull/766)
- **Refactor**: Reimplement internal store reading in terms of the [graphql-anywhere](https://github.com/apollostack/graphql-anywhere) package, which cleanly separates the GraphQL execution logic from Apollo's specific cache format. This will allow us to make the store reading much more extensible, including enabling developers to write their own custom client-side resolvers to implement client-side computed fields, read from Redux with GraphQL, and redirect cache reads.
- **Feature removal**: Remove query diffing functionality to make client more predictable and simplify implementation. Queries will still read from the store, and if the store does not have all of the necessary data the entire query will fetch from the server. Read justification and discussion in [Issue #615](https://github.com/apollostack/apollo-client/issues/615) [PR #693](https://github.com/apollostack/apollo-client/pull/693)
- **Breaking change**: Move batching to network interface and split off query merging into separate package [PR #734](https://github.com/apollostack/apollo-client/pull/734)
- **Feature removal**: No more `(read|diff)(Fragment|SelectionSet)FromStore`.
- **Feature removal**: No more `write(Fragment|SelectionSet)ToStore`.
- Fix: refetch only updates original query variable options
- Fix: Moved @types packages from devDependencies to dependencies as discussed in [Issue #713](https://github.com/apollostack/apollo-client/issues/713)
- **Refactor**: Rewrite how fragments are handled. Remove all validation of fragments when writing to the store, assuming that a spec-compliant server will return a valid set of fragments and results. On reading from the store, use `__typename` if it exists, and strongly encourage using the `addTypename: true` option by warning when the `__typename` field is not in the query and result. [Issue #739](https://github.com/apollostack/apollo-client/issues/739) [PR #767](https://github.com/apollostack/apollo-client/pull/767)
- GraphQL subscriptions fire an action when new data arrives [PR #775](https://github.com/apollostack/apollo-client/pull/775)
- **Feature removal and addition**: The `ApolloClient` constructor no longer accepts a `queryTransformer` option. Instead, there is a a new `addTypename` option which is on by default. [Issue #616](https://github.com/apollostack/apollo-client/issues/616) [PR #779](https://github.com/apollostack/apollo-client/pull/779)
- **Refactor**: removed circular dependency in data/store.ts [Issue #731](https://github.com/apollostack/apollo-client/issues/731) [PR #778](https://github.com/apollostack/apollo-client/pull/778)
- added "ApolloClient" to the named exports to make it compatible with Angular2 AOT compile [Issue #758](https://github.com/apollostack/apollo-client/issues/758) [PR #778](https://github.com/apollostack/apollo-client/pull/778)
- Fix: moved dev @types to devDependencies otherwise they potentially brake projects that are importing apollo-client [Issue #713](https://github.com/apollostack/apollo-client/issues/713) [PR #778](https://github.com/apollostack/apollo-client/pull/778)
- Fix rejecting promises on `refetch` and similar methods. Also improve error handling and stop using `ApolloError` internally. [Failing test in PR #524](https://github.com/apollostack/apollo-client/pull/524) [PR #781](https://github.com/apollostack/apollo-client/pull/781)
- Fix multidimentional array handling. [Issue #776](https://github.com/apollostack/apollo-client/issues/776) [PR #785](https://github.com/apollostack/apollo-client/pull/785)
- Add support for Enum inline arguments [Issue #183](https://github.com/apollostack/apollo-client/issues/183) [PR #788](https://github.com/apollostack/apollo-client/pull/788)
- Make it possible to subscribe to the same observable query multiple times. The query is initialized on the first subscription, and torn down after the last. Now, QueryManager is only aware of one subscription from the ObservableQuery, no matter how many were actually registered. This fixes issues with `result()` and other ObservableQuery features that relied on subscribing multiple times to work. This should remove the need for the workaround in `0.4.21`. [Repro in PR #694](https://github.com/apollostack/apollo-client/pull/694) [PR #791](https://github.com/apollostack/apollo-client/pull/791)

### v0.4.21
- Added some temporary functions (`_setVariablesNoResult` and `_setOptionsNoResult`) to work around a `react-apollo` problem fundamentally caused by the issue highlighted in [PR #694](https://github.com/apollostack/apollo-client/pull/694). The code as been refactored on `master`, so we expect it to be fixed in 0.5.x, and is not worth resolving now.

### v0.4.20
- Fix: Warn but do not fail when refetchQueries includes an unknown query name [PR #700](https://github.com/apollostack/apollo-client/pull/700)
- Fix: avoid field error on mutations after a query cancellation or a query failure by enforcing returnPartialData during previous data retrieval before applying a mutation update. [PR #696](https://github.com/apollostack/apollo-client/pull/696) and [Issue #647](https://github.com/apollostack/apollo-client/issues/647).
- Add observableQuery.setVariables function [PR #635](https://github.com/apollostack/apollo-client/pull/635)
- Add observableQuery.currentResult function [PR #697](https://github.com/apollostack/apollo-client/pull/697)
- Update to typescript 2.0.3 [PR #697](https://github.com/apollostack/apollo-client/pull/697)

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
