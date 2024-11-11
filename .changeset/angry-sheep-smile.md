---
"@apollo/client": patch
---

Fixed a bug when evaluating the devtools flag with the new syntax `devtool.enabled` that could result to `true` when eplicitly set to `false`.
