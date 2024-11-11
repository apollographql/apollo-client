---
"@apollo/client": patch
---

Fixed a bug when evaluating the devtools flag with the new syntax `devtools.enabled` that could result to `true` when explicitly set to `false`.
