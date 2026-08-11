---
"@apollo/client": minor
---

Field policy `read` and `merge` functions are now ignored when the field policy configures the `scalar` option. If a `read` or `merge` function is provided alongside `scalar`, a development-only warning is emitted.
