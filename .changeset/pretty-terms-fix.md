---
"@apollo/client": patch
---

Remove newly exported response iterator helpers that caused problems on some installs where `@types/node` was not available.
