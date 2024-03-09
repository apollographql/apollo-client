---
"@apollo/client": patch
---

Export `setVerbosity` from `@apollo/client/dev` so that invariant error messages
can be silenced with `setVerbosity("silent")`.
