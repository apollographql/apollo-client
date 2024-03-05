---
"@apollo/client": patch
---

Fix issue where calling `fetchMore` from a suspense-enabled hook inside `startTransition` caused an unnecessary rerender.
