---
"@apollo/client": patch
---

Fix an issue where partial cache data could leak into intermediate incremental results. This could cause runtime crashes if you relied on the presence of values to determine whether the `@defer` data had streamed in or not.
