---
"@apollo/client": patch
---

Fix `dataState` to report `"streaming"` instead of `"partial"` when `returnPartialData` is `true` and the cache result is missing only `@defer` fields.
