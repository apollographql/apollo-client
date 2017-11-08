# Change log

### vNEXT

### 1.1.0
- improve errors for id mismatch when writing to the store
- make it possible to swap the cache implementation. For example, you might want to use a `Map` to store the normalized objects, which can be faster than writing by keys to an `Object`. This also allows for custom use cases, such as emitting events on `.set()` or `.delete()` (think Observables), which was otherwise impossible without the use of Proxies, that are only available in some browsers. Unless you passed in the `store` to one of the `apollo-cache-inmemory` functions, such as: `writeQueryToStore` or `writeResultToStore`, no changes to your code are necessary. If you did access the cache's functions directly, all you need to do is add a `.toObject()` call on the cache — review the changes to the tests for [an example](https://github.com/apollographql/apollo-client/blob/cd563bcd1c2c15b973d0cdfd63332f5ee82da309/packages/apollo-cache-inmemory/src/__tests__/writeToStore.ts#L258). For reasoning behind this change and more information, see [Issue #2293](https://github.com/apollographql/apollo-client/issues/2293).

### 1.0.0
- Don't broadcast query watchers during a transaction (for example, while mutation results are being processed) [Issue #2221](https://github.com/apollographql/apollo-client/issues/2221) [PR #2358](https://github.com/apollographql/apollo-client/pull/2358)
- `readQuery` and `readFragment` return now the result instead of `Cache.DiffResult` [PR #2320](https://github.com/apollographql/apollo-client/pull/2320)

### 0.2.0-rc.1
- move to named export to be consistent with rest of apollo ecosystem

### 0.2.0-beta.6
- rename customResolvers to cacheResolvers with backwards compat

### 0.2.0-beta.5 and lower
- Fix error when missing __typename field in result [PR #2225](https://github.com/apollographql/apollo-client/pull/2225)
- Refactored type usage
- Prevented logging on defered queries
- Refactored internal store from apollo-client into own package
