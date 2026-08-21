---
"@apollo/client": patch
---

Align the remaining cache generic constraints with `Cache.Implementation`. The deprecated React mutation types (`MutationHookOptions`, `MutationFunctionOptions`, `MutationTuple`) and the internal `InternalRefetchQueriesOptions` and `QueryInfo` types still constrained their cache type parameter to `ApolloCache`, so they now match the rest of the overridable cache API.
