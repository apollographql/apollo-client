---
"@apollo/client": patch
---

Fix a potential memory leak in `FragmentRegistry.transform` and `FragmentRegistry.findFragmentSpreads` that would hold on to passed-in `DocumentNodes` for too long.
