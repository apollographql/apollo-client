---
"@apollo/client": patch
---

Passes `getServerSnapshot` to `useSyncExternalStore` so that it doesn't trigger a `Missing getServerSnapshot` error when using `useFragment_experimental` on the server.
