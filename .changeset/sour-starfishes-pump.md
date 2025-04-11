---
"@apollo/client": patch
---

Ensure `variables` passed to the `update` callback is `undefined` instead of an empty object when `variables` are not defined.
