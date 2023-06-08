---
'@apollo/client': patch
---

Moves `DocumentTransform` to the `utilities` sub-package to avoid a circular dependency between the `core` and `cache` sub-packages.
