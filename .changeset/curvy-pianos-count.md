---
"@apollo/client": major
---

Remove deprecated `ignoreResults` option from `useMutation`. If you don't want to synchronize component state with the mutation, use `useApolloClient` to access your client instance and use `client.mutate` directly.
