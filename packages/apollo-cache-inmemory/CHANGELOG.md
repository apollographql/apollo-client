# Change log

### vNEXT

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
