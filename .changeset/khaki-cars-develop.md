---
"@apollo/client": patch
---

Deprecate option `ignoreResults` in `useMutation`.
Once this option is removed, existing code still using it might see increase in re-renders.
Instead, please use `useApolloClient` to get your ApolloClient instance and call `client.mutate` directly.
