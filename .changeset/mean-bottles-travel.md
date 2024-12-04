---
"@apollo/client": patch
---

Fix issue where the warning emitted by `@unmask(mode: "migrate")` would trigger unnecessarily when the fragment was used alongside a masked fragment inside an inline fragment.
