---
"@apollo/client": patch
---

Fixes an issue where `client.readFragment` and `client.readQuery` ignored the `optimistic` option when passed in the options object.
