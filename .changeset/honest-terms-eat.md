---
"@apollo/client": patch
---

Fixes an issue where `useLazyQuery` would not apply a changed `pollInterval` between renders.
