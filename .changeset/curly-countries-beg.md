---
'@apollo/client': patch
---

Ensure the `client` option passed to `useMutation`'s execute function is used when provided. Previously this option was ignored.
