---
"@apollo/client": patch
---

Fix issue where passing a new `from` option to `useFragment` would first render with the previous value before rerendering with the correct value.
