---
"@apollo/client": patch
---

Fix an issue where `@defer` chunk patches target the wrong entity when items are prepended or reordered in a cached list while incremental responses are in flight.
