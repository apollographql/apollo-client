---
'@apollo/client': patch
---

Fix a bug in `QueryReference` where `this.resolve` or `this.reject` might be executed even if `undefined`.
