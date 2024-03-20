---
"@apollo/client": patch
---

Fix issue in all suspense hooks where returning an empty array after calling `fetchMore` would rerender the component with an empty list.
