---
"@apollo/client": patch
---

Fix an issue where a sibling non-deferred fragment might be accidentally pruned when the `@defer` fragment hadn't been delivered.
