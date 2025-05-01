---
"@apollo/client": major
---

Remove the `resolvers` option passed to `ApolloClient`. This removes the ability to define local resolvers in Apollo ClIent core. To use local resolvers, use `LocalResolversLink` instead.

This change also removes the `fragmentMatcher` option which was used with local resolvers. Other methods removed as a result of removing local resolvers are:
- `addResolvers`
- `getResolvers`
- `setResolvers`
- `setLocalStateFragmentMatcher`
