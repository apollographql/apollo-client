---
"@apollo/client": patch
---

`Defer20220824Handler`: fix a situation where `dataState` would show up as `completed` with incremental errors instead of staying `streaming`.
