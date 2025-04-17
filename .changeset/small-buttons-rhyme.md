---
"@apollo/client": major
---

Remove the deprecated `canonizeResults` option. It was prone to memory leaks. As such, some results that were referentially equal when `canonizeResults` option was set to `true` no longer retain the same object identity.
