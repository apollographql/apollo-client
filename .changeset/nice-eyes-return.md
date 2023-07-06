---
'@apollo/client': minor
---

When changing variables back to a previously used set of variables, do not automatically cache the result as part of the query reference. Instead, dispose of the query reference so that the `InMemoryCache` can determine the cached behavior. This means that fetch policies that would guarantee a network request are now honored when switching back to previously used variables.
