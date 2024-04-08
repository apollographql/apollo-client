---
"@apollo/client": patch
---

Fix an issue where using `skipToken` or the `skip` option with `useSuspenseQuery` in React's strict mode would perform a network request.
