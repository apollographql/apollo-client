**Note:** This is a cumulative changelog that outlines all of the Apollo Client project child package changes that were bundled into a specific `apollo-client` release.

## Apollo Client (vNext)

### Apollo Client (vNext)

- Documtation and config updates.  <br/>
  [@justinanastos](https://github.com/justinanastos) in [#4187](https://github.com/apollographql/apollo-client/pull/4187)  <br/>
  [@PowerKiKi](https://github.com/PowerKiKi) in [#3693](https://github.com/apollographql/apollo-client/pull/3693)  <br/>
  [@nandito](https://github.com/nandito) in [#3865](https://github.com/apollographql/apollo-client/pull/3865)

### Apollo Utilities (vNext)

- Schema/AST tranformation utilities have been updated to work properly with
  `@client` directives.  <br/>
  [@justinmakaila](https://github.com/justinmakaila) in [#3482](https://github.com/apollographql/apollo-client/pull/3482)


## Apollo Client (2.4.7)

### Apollo Client (2.4.7)

- The `ApolloClient` constructor has been updated to accept `name` and
  `version` params, that can be used to support Apollo Server [Client Awareness](https://www.apollographql.com/docs/apollo-server/v2/features/metrics.html#Client-Awareness)
  functionality. These client awareness properties are passed into the
  defined Apollo Link chain, and are then ultimately sent out as custom
  headers with outgoing requests.  <br/>
  [@hwillson](https://github.com/hwillson) in [#4154](https://github.com/apollographql/apollo-client/pull/4154)

### Apollo Boost (0.1.22)

- No changes.

### Apollo Cache (1.1.21)

- No changes.

### Apollo Cache In-Memory (1.3.11)

- No changes.

### Apollo Utilities (1.0.26)

- No changes.

### Graphql Anywhere (4.1.23)

- No changes.


## Apollo Client (2.4.6)

### Apollo Cache In-Memory (1.3.10)

- Added some `return`s to prevent errors with `noImplicitReturns`
  TypeScript rule.
  [PR #4137](https://github.com/apollographql/apollo-client/pull/4137)

- Exclude the `src/` directory when publishing `apollo-cache-inmemory`.
  [Issue #4083](https://github.com/apollographql/apollo-client/issues/4083)

## Apollo Client (2.4.5)

- Optimistic tests cleanup.
  [PR #3834](https://github.com/apollographql/apollo-client/pull/3834) by
  [@joshribakoff](https://github.com/joshribakoff)

- Documentation updates.
  [PR #3840](https://github.com/apollographql/apollo-client/pull/3840) by
  [@chentsulin](https://github.com/chentsulin) and
  [PR #3844](https://github.com/apollographql/apollo-client/pull/3844) by
  [@lorensr](https://github.com/lorensr)

- Implement `ObservableQuery#isDifferentFromLastResult` to fix
  [Issue #4054](https://github.com/apollographql/apollo-client/issues/4054) and
  [Issue #4031](https://github.com/apollographql/apollo-client/issues/4031).
  [PR #4069](https://github.com/apollographql/apollo-client/pull/4069)

### Apollo Cache (1.1.20)

- Add `readQuery` test to make sure options aren't mutated.
  [@CarloPalinckx](https://github.com/CarloPalinckx) in
  [#3838](https://github.com/apollographql/apollo-client/pull/3838)

### Apollo Cache In-Memory (1.3.9)

- Avoid modifying source objects when merging cache results.
  [Issue #4081](https://github.com/apollographql/apollo-client/issues/4081)
  [PR #4089](https://github.com/apollographql/apollo-client/pull/4089)

### Apollo Utilities (1.0.25)

- Fix `apollo-utilities` `isEqual` bug due to missing `hasOwnProperty`
  check. [PR #4072](https://github.com/apollographql/apollo-client/pull/4072)
  by [@samkline](https://github.com/samkline)

## Apollo Client (2.4.4)

### Apollo Utilities (1.0.24)

- Discard property accessor functions in `cloneDeep` helper, to fix
  [issue #4034](https://github.com/apollographql/apollo-client/issues/4034).

- Unconditionally remove `cloneDeep` property accessors.
  [PR #4039](https://github.com/apollographql/apollo-client/pull/4039)

- Avoid copying non-enumerable and/or `Symbol` keys in `cloneDeep`.
  [PR #4052](https://github.com/apollographql/apollo-client/pull/4052)

### Apollo Cache In-Memory (1.3.7)

- Throw when querying non-scalar objects without a selection set.
  [Issue #4025](https://github.com/apollographql/apollo-client/issues/4025)
  [PR #4038](https://github.com/apollographql/apollo-client/pull/4038)

- Work around spec non-compliance of `Map#set` and `Set#add` in IE11.
  [Issue #4024](https://github.com/apollographql/apollo-client/issues/4024)
  [PR #4012](https://github.com/apollographql/apollo-client/pull/4012)

## Apollo Client (2.4.3)

- Add additional checks to make sure we don't try to set the network status
  of queries in the store, when the store doesn't exist.  <br/>
  [@i6mi6](https://github.com/i6mi6) in [#3914](https://github.com/apollographql/apollo-client/pull/3914)
- Documentation updates.  <br/>
  [@shanonvl](https://github.com/shanonvl) in [#3925](https://github.com/apollographql/apollo-client/pull/3925)  <br/>
  [@ojh102](https://github.com/ojh102) in [#3920](https://github.com/apollographql/apollo-client/pull/3920)  <br/>
  [@Bkucera](https://github.com/Bkucera) in [#3919](https://github.com/apollographql/apollo-client/pull/3919)  <br/>
  [@j4chou](https://github.com/j4chou) in [#3915](https://github.com/apollographql/apollo-client/pull/3915)  <br/>
  [@billfienberg](https://github.com/billfienberg) in [#3886](https://github.com/apollographql/apollo-client/pull/3886)  <br/>
  [@TLadd](https://github.com/TLadd) in [#3884](https://github.com/apollographql/apollo-client/pull/3884)

- The `ObservableQuery` class now makes a deep clone of `lastResult` when
  first received, so that the `isDifferentResult` logic will not be
  confused if the result object is modified later.
  [Issue #3992](https://github.com/apollographql/apollo-client/issues/3992)
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/e66027c5341dc7aaf71ee7ffcba1305b9a553525)

### Apollo Cache In-Memory (1.3.6)

- Optimize repeated `apollo-cache-inmemory` reads by caching partial query
  results, for substantial performance improvements. As a consequence, watched
  queries will not be rebroadcast unless the data have changed.
  [PR #3394](https://github.com/apollographql/apollo-client/pull/3394)

- Include root ID and fragment matcher function in cache keys computed by
  `StoreReader#executeStoreQuery` and `executeSelectionSet`, and work
  around bugs in the React Native `Map` and `Set` polyfills.
  [PR #3964](https://github.com/apollographql/apollo-client/pull/3964)
  [React Native PR #21492 (pending)](https://github.com/facebook/react-native/pull/21492)

- The `apollo-cache-inmemory` package now allows `graphql@^14.0.0` as a
  peer dependency.
  [Issue #3978](https://github.com/apollographql/apollo-client/issues/3978)

- The `apollo-cache-inmemory` package now correctly broadcasts changes
  even when the new data is `===` to the old data, since the contents of
  the data object may have changed.
  [Issue #3992](https://github.com/apollographql/apollo-client/issues/3992)
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/d6a673fbc1444e115e90cc9e4c7fa3fc67bb7e56)

### Apollo GraphQL Anywhere (4.1.20)

- Make `graphql-anywhere` `filter` function generic (typescript).  <br/>
  [@minznerjosh](https://github.com/minznerjosh) in [#3929](https://github.com/apollographql/apollo-client/pull/3929)

### Apollo Utilities (1.0.22)

- The `fclone` package has been replaced with a custom `cloneDeep`
  implementation that is tolerant of cycles, symbol properties, and
  non-enumerable properties.
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/78e2ad89f950da2829f49c7876f968adb2bc1302)

### Apollo Boost (0.1.17)

- Remove duplicate InMemoryCache export for Babel 6 compatibility.
  [Issue #3910](https://github.com/apollographql/apollo-client/issues/3910)
  [PR #3932](https://github.com/apollographql/apollo-client/pull/3932)

### Apollo Cache (1.1.18)

- No changes.

## Apollo Client (2.4.2)

### Apollo Client (2.4.2)

- Apollo Client no longer deep freezes query results.
  [@hwillson](https://github.com/hwillson) in [#3883](https://github.com/apollographql/apollo-client/pull/3883)
- A new `clearStore` method has been added, that will remove all data from
  the store. Unlike `resetStore`, it will not refetch active queries after
  removing store data.
  [@hwillson](https://github.com/hwillson) in [#3885](https://github.com/apollographql/apollo-client/pull/3885)

### Apollo Utilities (1.0.21)

- Replace the custom `cloneDeep` implementation with
  [`fclone`](https://www.npmjs.com/package/fclone), to avoid crashing when
  encountering circular references.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3881](https://github.com/apollographql/apollo-client/pull/3881)

### Apollo Boost (0.1.16)

- No changes.

### Apollo Cache (1.1.17)

- No changes.

### Apollo Cache In-Memory (1.2.10)

- No changes.

### Apollo GraphQL Anywhere (4.1.19)

- No changes.


## 2.4.1 (August 26, 2018)

### Apollo Client (2.4.1)

- `mutate`'s `refetchQueries` option now allows queries to include a custom
  `context` option. This `context` will be used when refetching the query.
  For example:

  ```js
  context = {
    headers: {
      token: 'some auth token',
    },
  };
  client.mutate({
    mutation: UPDATE_CUSTOMER_MUTATION,
    variables: {
      userId: user.id,
      firstName,
      ...
    },
    refetchQueries: [{
      query: CUSTOMER_MESSAGES_QUERY,
      variables: { userId: user.id },
      context,
    }],
    context,
  });
  ```

  The `CUSTOMER_MESSAGES_QUERY` above will be refetched using `context`.
  Normally queries are refetched using the original context they were first
  started with, but this provides a way to override the context, if needed.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3852](https://github.com/apollographql/apollo-client/pull/3852)

- Documentation updates.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3841](https://github.com/apollographql/apollo-client/pull/3841)

### Apollo Boost (0.1.15)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Cache (1.1.16)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Cache In-Memory (1.2.9)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Utilities (1.0.20)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo GraphQL Anywhere (4.1.18)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)


## 2.4.0 (August 17, 2018)

### Apollo Client (2.4.0)

- Add proper error handling for subscriptions. If you have defined an `error`
  handler on your subscription observer, it will now be called when an error
  comes back in a result, and the `next` handler will be skipped (similar to
  how we're handling errors with mutations). Previously, the error was
  just passed in the result to the `next` handler. If you don't have an
  `error` handler defined, the previous functionality is maintained, meaning
  the error is passed in the result, giving the next handler a chance to deal
  with it. This should help address backwards compatibility (and is the reason
  for the minor version bumo in this release).  <br/>
  [@clayne11](https://github.com/clayne11) in [#3800](https://github.com/apollographql/apollo-client/pull/3800)
- Allow an `optimistic` param to be passed into `ApolloClient.readQuery` and
  `ApolloClient.readFragment`, that when set to `true`, will allow
  optimistic results to be returned. Is `false` by default.  <br/>
  [@jay1337](https://github.com/jay1337) in [#2429](https://github.com/apollographql/apollo-client/pull/2429)
- Optimistic tests cleanup.  <br/>
  [@joshribakoff](https://github.com/joshribakoff) in [#3713](https://github.com/apollographql/apollo-client/pull/3713)
- Make sure each package has its own `.npmignore`, so they're taken into
  consideration when publishing via lerna.  <br/>
  [@hwillson](https://github.com/hwillson) in [#3828](https://github.com/apollographql/apollo-client/pull/3828)
- Documentation updates.  <br/>
  [@toolness](https://github.com/toolness) in [#3804](https://github.com/apollographql/apollo-client/pull/3804)  <br/>
  [@pungggi](https://github.com/pungggi) in [#3798](https://github.com/apollographql/apollo-client/pull/3798)  <br/>
  [@lorensr](https://github.com/lorensr) in [#3748](https://github.com/apollographql/apollo-client/pull/3748)  <br/>
  [@joshribakoff](https://github.com/joshribakoff) in [#3730](https://github.com/apollographql/apollo-client/pull/3730)  <br/>
  [@yalamber](https://github.com/yalamber) in [#3819](https://github.com/apollographql/apollo-client/pull/3819)  <br/>
  [@pschreibs85](https://github.com/pschreibs85) in [#3812](https://github.com/apollographql/apollo-client/pull/3812)  <br/>
  [@msreekm](https://github.com/msreekm) in [#3808](https://github.com/apollographql/apollo-client/pull/3808)  <br/>
  [@kamaltmo](https://github.com/kamaltmo) in [#3806](https://github.com/apollographql/apollo-client/pull/3806)  <br/>
  [@lorensr](https://github.com/lorensr) in [#3739](https://github.com/apollographql/apollo-client/pull/3739)  <br/>
  [@brainkim](https://github.com/brainkim) in [#3680](https://github.com/apollographql/apollo-client/pull/3680)

### Apollo Cache In-Memory (1.2.8)

- Fix typo in `console.warn` regarding fragment matching error message.  <br/>
  [@combizs](https://github.com/combizs) in [#3701](https://github.com/apollographql/apollo-client/pull/3701)

### Apollo Boost (0.1.14)

- No changes.

### Apollo Cache (1.1.15)

- No changes.

### Apollo Utilities (1.0.19)

- No changes.

### Apollo GraphQL Anywhere (4.1.17)

- No changes.


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
