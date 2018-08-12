**Note:** This is a cumulative changelog that outlines all of the Apollo Client project child package changes that were bundled into a specific `apollo-client` release.

## vNext

### Apollo Client (vNext)

- Allow an `optimistic` param to be passed into `ApolloClient.readQuery` and
  `ApolloClient.readFragment`, that when set to `true`, will allow
  optimistic results to be returned. Is `false` by default.  <br/>
  [@jay1337](https://github.com/jay1337) in [#2429](https://github.com/apollographql/apollo-client/pull/2429)
- Documentation updates.  <br/>
  [@toolness](https://github.com/toolness) in [#3804](https://github.com/apollographql/apollo-client/pull/3804)  <br/>
  [@pungggi](https://github.com/pungggi) in [#3798](https://github.com/apollographql/apollo-client/pull/3798)  <br/>
  [@lorensr](https://github.com/lorensr) in [#3748](https://github.com/apollographql/apollo-client/pull/3748)  <br/>
  [@joshribakoff](https://github.com/joshribakoff) in [#3730](https://github.com/apollographql/apollo-client/pull/3730)

### Apollo Cache In-Memory (vNext)

- Fix typo in `console.warn` regarding fragment matching error message.  <br/>
  [@combizs](https://github.com/combizs) in [#3701](https://github.com/apollographql/apollo-client/pull/3701)


## 2.3.8 (August 9, 2018)

### Apollo Client (2.3.8)

- Adjusted the `graphql` peer dependency to cover explicit minor ranges.
  Since the ^ operator only covers any minor version if the major version
  is not 0 (since a major version of 0 is technically considered development by
  semver 2), the current ^0.11.0 || ^14.0.0 graphql range doesn't cover
  0.12.* or 0.13.*. This fixes the `apollo-client@X has incorrect peer
  dependency "graphql@^0.11.0 || ^14.0.0"` errors that people might have
  seen using `graphql` 0.12.x or 0.13.x.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3746](https://github.com/apollographql/apollo-client/pull/3746)
- Document `setVariables` internal API status.  <br/>
  [@PowerKiKi](https://github.com/PowerKiKi) in [#3692](https://github.com/apollographql/apollo-client/pull/3692)
- Corrected `ApolloClient.queryManager` typing as it may be `undefined`.  <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#3661](https://github.com/apollographql/apollo-client/pull/3661)
- Make sure using a `no-cache` fetch policy with subscriptions prevents data
  from being cached.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3773](https://github.com/apollographql/apollo-client/pull/3773)
- Fixed an issue that sometimes caused empty query results, when using the
  `no-cache` fetch policy.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3777](https://github.com/apollographql/apollo-client/pull/3777)
- Documentation updates.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3750](https://github.com/apollographql/apollo-client/pull/3750)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3754](https://github.com/apollographql/apollo-client/pull/3754)  <br/>
  [@TheMightyPenguin](https://github.com/TheMightyPenguin) in [#3725](https://github.com/apollographql/apollo-client/pull/3725)  <br/>
  [@bennypowers](https://github.com/bennypowers) in [#3668](https://github.com/apollographql/apollo-client/pull/3668)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3762](https://github.com/apollographql/apollo-client/pull/3762)  <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3688](https://github.com/apollographql/apollo-client/pull/3688)  <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3687](https://github.com/apollographql/apollo-client/pull/3687)  <br/>
  [@ardouglass](https://github.com/ardouglass) in [#3645](https://github.com/apollographql/apollo-client/pull/3645)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3764](https://github.com/apollographql/apollo-client/pull/3764)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3767](https://github.com/apollographql/apollo-client/pull/3767)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3774](https://github.com/apollographql/apollo-client/pull/3774)  <br/>
  [@hwillson](https://github.com/hwillson) in [#3779](https://github.com/apollographql/apollo-client/pull/3779)

### Apollo Boost (0.1.13)

- No changes.

### Apollo Cache In-Memory (1.2.7)

- No changes.

### Apollo Cache (1.1.14)

- No changes.

### Apollo Utilities (1.0.18)

- No changes.

### Apollo GraphQL Anywhere (4.1.16)

- No changes.


## 2.3.7 (July 24, 2018)

### Apollo Client (2.3.7)

- Release 2.3.6 broke Typescript compilation. `QueryManager`'s
  `getQueryWithPreviousResult` method included an invalid `variables` return
  type in the auto-generated `core/QueryManager.d.ts` declaration file. The
  type definition had a locally referenced path, that appears to have been
  caused by the typescript compiler getting confused at compile/publish time.
  `getQueryWithPreviousResult` return types are now excplicity identified,
  which helps Typescript avoid the local type reference. For more details,
  see https://github.com/apollographql/apollo-client/issues/3729.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3731](https://github.com/apollographql/apollo-client/pull/3731)

### Apollo Boost (0.1.12)

- No changes.


## 2.3.6 (July 24, 2018)

### Apollo Client (2.3.6)

- Documentation updates. <br/>
  [@ananth99](https://github.com/ananth99) in [#3599](https://github.com/apollographql/apollo-client/pull/3599) <br/>
  [@hwillson](https://github.com/hwillson) in [#3635](https://github.com/apollographql/apollo-client/pull/3635) <br/>
  [@JakeDawkins](https://github.com/JakeDawkins) in [#3642](https://github.com/apollographql/apollo-client/pull/3642) <br/>
  [@hwillson](https://github.com/hwillson) in [#3644](https://github.com/apollographql/apollo-client/pull/3644) <br/>
  [@gbau](https://github.com/gbau) in [#3644](https://github.com/apollographql/apollo-client/pull/3600) <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3608](https://github.com/apollographql/apollo-client/pull/3608) <br/>
  [@MikaelCarpenter](https://github.com/MikaelCarpenter) in [#3609](https://github.com/apollographql/apollo-client/pull/3609) <br/>
  [@Gamezpedia](https://github.com/Gamezpedia) in [#3612](https://github.com/apollographql/apollo-client/pull/3612) <br/>
  [@jinxac](https://github.com/jinxac) in [#3647](https://github.com/apollographql/apollo-client/pull/3647) <br/>
  [@abernix](https://github.com/abernix) in [#3705](https://github.com/apollographql/apollo-client/pull/3705) <br/>
  [@dandv](https://github.com/dandv) in [#3703](https://github.com/apollographql/apollo-client/pull/3703) <br/>
  [@hwillson](https://github.com/hwillson) in [#3580](https://github.com/apollographql/apollo-client/pull/3580) <br/>
- Updated `graphql` `peerDependencies` to handle 14.x versions. <br/>
  [@ivank](https://github.com/ivank) in [#3598](https://github.com/apollographql/apollo-client/pull/3598)
- Add optional generic type params for variables on low level methods. <br/>
  [@mvestergaard](https://github.com/mvestergaard) in [#3588](https://github.com/apollographql/apollo-client/pull/3588)
- Add a new `awaitRefetchQueries` config option to the Apollo Client
  `mutate` function, that when set to `true` will wait for all
  `refetchQueries` to be fully refetched, before resolving the mutation
  call. `awaitRefetchQueries` is `false` by default. <br/>
  [@jzimmek](https://github.com/jzimmek) in [#3169](https://github.com/apollographql/apollo-client/pull/3169)

### Apollo Boost (0.1.11)

- Allow `fetch` to be given as a configuration option to `ApolloBoost`. <br/>
  [@mbaranovski](https://github.com/mbaranovski) in [#3590](https://github.com/apollographql/apollo-client/pull/3590)
- The `apollo-boost` `ApolloClient` constructor now warns about unsupported
  options. <br/>
  [@quentin-](https://github.com/quentin-) in [#3551](https://github.com/apollographql/apollo-client/pull/3551)

### Apollo Cache (1.1.13)

- No changes.

### Apollo Cache In-Memory (1.2.6)

- Add `__typename` and `id` properties to `dataIdFromObject` parameter
  (typescript) <br/>
  [@jfurler](https://github.com/jfurler) in [#3641](https://github.com/apollographql/apollo-client/pull/3641)
- Fixed an issue caused by `dataIdFromObject` considering returned 0 values to
  be falsy, instead of being a valid ID, which lead to the store not being
  updated properly in some cases. <br/>
  [@hwillson](https://github.com/hwillson) in [#3711](https://github.com/apollographql/apollo-client/pull/3711)

### Apollo Utilities (1.0.17)

- No changes.

### Apollo GraphQL Anywhere (4.1.15)

- Add support for arrays to `graphql-anywhere`'s filter utility. <br/>
  [@jsweet314](https://github.com/jsweet314) in [#3591](https://github.com/apollographql/apollo-client/pull/3591)
- Fix `Cannot convert object to primitive value` error that was showing up
  when attempting to report a missing property on an object. <br/>
  [@benjie](https://github.com/benjie) in [#3618](https://github.com/apollographql/apollo-client/pull/3618)


## 2.3.5 (June 19, 2018)

### Apollo Client (2.3.5)

- Internal code formatting updates.
  - [@chentsulin](https://github.com/chentsulin) in [#3574](https://github.com/apollographql/apollo-client/pull/3574)
- Documentation updates.
  - [@andtos90](https://github.com/andtos90) in [#3596](https://github.com/apollographql/apollo-client/pull/3596)
  - [@serranoarevalo](https://github.com/serranoarevalo) in [#3554](https://github.com/apollographql/apollo-client/pull/3554)
  - [@cooperka](https://github.com/cooperka) in [#3594](https://github.com/apollographql/apollo-client/pull/3594)
  - [@pravdomil](https://github.com/pravdomil) in [#3587](https://github.com/apollographql/apollo-client/pull/3587)
  - [@excitement-engineer](https://github.com/excitement-engineer) in [#3309](https://github.com/apollographql/apollo-client/pull/3309)

### Apollo Boost (0.1.10)

- No changes.

### Apollo Cache (1.1.12)

- No changes.

### Apollo Cache In-Memory (1.2.5)

- No changes.

### Apollo Utilities (1.0.16)

- Removed unnecessary whitespace from error message.
  - [@mbaranovski](https://github.com/mbaranovski) in [#3593](https://github.com/apollographql/apollo-client/pull/3593)

### Apollo GraphQL Anywhere (4.1.14)

- No changes.


## 2.3.4 (June 13, 2018)

### Apollo Client (2.3.4)

- Export the `QueryOptions` interface, to make sure it can be used by other
  projects (like `apollo-angular`).
- Fixed an issue caused by typescript changes to the constructor
  `defaultOptions` param, that prevented `query` defaults from passing type
  checks.
  ([@hwillson](https://github.com/hwillson) in [#3585](https://github.com/apollographql/apollo-client/pull/3585))

### Apollo Boost (0.1.9)

- No changes

### Apollo Cache (1.1.11)

- No changes

### Apollo Cache In-Memory (1.2.4)

- No changes

### Apollo Utilities (1.0.15)

- No changes

### Apollo GraphQL Anywhere (4.1.13)

- No changes


## 2.3.3 (June 13, 2018)

### Apollo Client (2.3.3)

- Typescript improvements. Made observable query parameterized on data and
  variables: `ObservableQuery<TData, TVariables>`
  ([@excitement-engineer](https://github.com/excitement-engineer) in [#3140](https://github.com/apollographql/apollo-client/pull/3140))
- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))
- Typescript improvements. Created a new `QueryOptions` interface that
  is now used by `ApolloClient.query` options, instead of the previous
  `WatchQueryOptions` interface. This helps reduce confusion (especially
  in the docs) that made it look like `ApolloClient.query` accepted
  `ApolloClient.watchQuery` only options, like `pollingInterval`.
  ([@hwillson](https://github.com/hwillson) in [#3569](https://github.com/apollographql/apollo-client/pull/3569))

### Apollo Boost (0.1.8)

- Allow `cache` to be given as a configuration option to `ApolloBoost`.
  ([@dandean](https://github.com/dandean) in [#3561](https://github.com/apollographql/apollo-client/pull/3561))
- Allow `headers` and `credentials` to be passed in as configuration
  parameters to the `apollo-boost` `ApolloClient` constructor.
  ([@rzane](https://github.com/rzane) in [#3098](https://github.com/apollographql/apollo-client/pull/3098))

### Apollo Cache (1.1.10)

- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))

### Apollo Cache In-Memory (1.2.3)

- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))
- Restore non-enumerability of `resultFields[ID_KEY]`.
  ([@benjamn](https://github.com/benjamn) in [#3544](https://github.com/apollographql/apollo-client/pull/3544))
- Cache query documents transformed by InMemoryCache.
  ([@benjamn](https://github.com/benjamn) in [#3553](https://github.com/apollographql/apollo-client/pull/3553))

### Apollo Utilities (1.0.14)

- Store key names generated by `getStoreKeyName` now leverage a more
  deterministic approach to handling JSON based strings. This prevents store
  key names from differing when using `args` like
  `{ prop1: 'value1', prop2: 'value2' }` and
  `{ prop2: 'value2', prop1: 'value1' }`.
  ([@gdi2290](https://github.com/gdi2290) in [#2869](https://github.com/apollographql/apollo-client/pull/2869))
- Avoid needless `hasOwnProperty` check in `deepFreeze`.
  ([@benjamn](https://github.com/benjamn) in [#3545](https://github.com/apollographql/apollo-client/pull/3545))

### Apollo GraphQL Anywhere (4.1.12)

- No new changes.


## 2.3.2 (May 29, 2018)

### Apollo Client (2.3.2)

- Fix SSR and `cache-and-network` fetch policy
  ([@dastoori](https://github.com/dastoori) in [#3372](https://github.com/apollographql/apollo-client/pull/3372))
- Fixed an issue where the `updateQuery` method passed to
  `ObservableQuery.fetchMore` was receiving the original query variables,
  instead of the new variables that it used to fetch more data.
  ([@abhiaiyer91](https://github.com/abhiaiyer91) in [#3500](https://github.com/apollographql/apollo-client/pull/3500))
- Fixed an issue involving `Object.setPrototypeOf()` not working on JSC
  (Android), by instead setting the `prototype` of `this` manually.
  ([@seklyza](https://github.com/seklyza) in [#3306](https://github.com/apollographql/apollo-client/pull/3306))
- Added safeguards to make sure `QueryStore.initQuery` and
  `QueryStore.markQueryResult` don't try to set the network status of a
  `fetchMoreForQueryId` query, if it does not exist in the store. This was
  happening when a query component was unmounted while a `fetchMore` was still
  in flight.
  ([@conrad-vanl](https://github.com/conrad-vanl) in [#3367](https://github.com/apollographql/apollo-client/pull/3367), [@doomsower](https://github.com/doomsower) in [#3469](https://github.com/apollographql/apollo-client/pull/3469))

### Apollo Boost (0.1.7)

- Various internal code cleanup, tooling and dependency changes.

### Apollo Cache (1.1.9)

- Various internal code cleanup, tooling and dependency changes.

### Apollo Cache In-Memory (1.2.2)

- Fixed an issue that caused fragment only queries to sometimes fail.
  ([@abhiaiyer91](https://github.com/abhiaiyer91) in [#3507](https://github.com/apollographql/apollo-client/pull/3507))
- Fixed cache invalidation for inlined mixed types in union fields within
  arrays.
  ([@dferber90](https://github.com/dferber90) in [#3422](https://github.com/apollographql/apollo-client/pull/3422))

### Apollo Utilities (1.0.13)

- Make `maybeDeepFreeze` a little more defensive, by always using
  `Object.prototype.hasOwnProperty` (to avoid cases where the object being
  frozen doesn't have its own `hasOwnProperty`).
  ([@jorisroling](https://github.com/jorisroling) in [#3418](https://github.com/apollographql/apollo-client/pull/3418))
- Remove certain small internal caches to prevent memory leaks when using SSR.
  ([@brunorzn](https://github.com/brunorzn) in [#3444](https://github.com/apollographql/apollo-client/pull/3444))

### Apollo GraphQL Anywhere (4.1.11)

- Source files are now excluded when publishing to npm.
  ([@hwillson](https://github.com/hwillson) in [#3454](https://github.com/apollographql/apollo-client/pull/3454))
