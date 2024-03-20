---
"@apollo/client": patch
---

Fix issue where setting a default `watchQuery` option in the `ApolloClient` constructor could break `startTransition` when used with suspense hooks.
