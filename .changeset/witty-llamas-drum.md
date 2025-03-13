---
"@apollo/client": major
---

Add a new `dataState` property to `ApolloQueryResult` that determines whether the `data` property is a complete result or not. As such, the `ApolloQueryResult` type is now a discriminated union that better handles the type of `data` given its particular state. The values are:

- `none`: No data could be fulfilled from the cache or the result is incomplete. `data` is `undefined`.
- `partial`: Some data could be fulfilled from the cache but `data` is incomplete. This is only possible when `returnPartialData` is `true`.
- `streaming`: `data` is incomplete as a result of a deferred query and the result is still streaming in.
- `complete`: `data` is a fully satisfied query result fulfilled either from the cache or network.
