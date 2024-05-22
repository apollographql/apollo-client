---
"@apollo/client": patch
---

Fix a bug where calling the `useMutation` `reset` function would point the hook to an outdated `client` reference.
