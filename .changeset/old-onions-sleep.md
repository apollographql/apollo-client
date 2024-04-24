---
"@apollo/client": patch
---

Export `WatchFragmentOptions` and `WatchFragmentResult` from main entrypoint and fix bug where `this` wasn't bound to the `watchFragment` method on `ApolloClient`.
