---
"@apollo/client": patch
---

Fix an issue where a `network-only` query leaked partial cache data for `@defer` fragments that were not delivered by the network due to an error that bubbled to the `@defer` fragment boundary.
