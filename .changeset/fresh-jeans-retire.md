---
"@apollo/client": patch
---

Fix delay: Infinity when set on a MockResponse passed to Mocked Provider so it indefinitely enters loading state.
