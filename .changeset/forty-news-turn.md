---
"@apollo/client": patch
---

Fixes a regression from where passing an invalid identifier to `from` in `useFragment` would result in the warning `TypeError: Cannot read properties of undefined (reading '__typename')`.
