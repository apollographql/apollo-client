---
"@apollo/client": minor
---


Add a new `dataState` property that determines the completeness of the `data` property. `dataState` helps narrow the type of `data`. `dataState` is now emitted from `ObservableQuery` and returned from all React hooks that return a `data` property.

The `dataState` values are:

- `empty`: No data could be fulfilled from the cache or the result is incomplete. `data` is `undefined`.
- `partial`: Some data could be fulfilled from the cache but `data` is incomplete. This is only possible when `returnPartialData` is `true`.
- `streaming`: `data` is incomplete as a result of a deferred query and the result is still streaming in.
- `complete`: `data` is a fully satisfied query result fulfilled either from the cache or network.
