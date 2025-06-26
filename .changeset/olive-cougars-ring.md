---
"@apollo/client": major
_tags:
  - LocalState
  - removals
  - ApolloClient
---

Remove local resolvers APIs from `ApolloClient` in favor of `localState`. Methods removed are:
- `addResolvers`
- `getResolvers`
- `setResolvers`
- `setLocalStateFragmentMatcher`
