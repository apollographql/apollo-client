---
"@apollo/client": patch
---

The `variables` option used with various APIs are now enforced more consistently across the client when `TVariables` contains required variables. If required `variables` are not provided, TypeScript will now complain that it requires a `variables` option.

This change affects the following APIs:
- `client.query`
- `client.mutate`
- `client.subscribe`
- `client.watchQuery`
- `useBackgroundQuery`
- `useQuery`
- `useSubscription`
- `useSuspenseQuery`
