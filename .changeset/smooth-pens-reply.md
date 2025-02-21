---
"@apollo/client": major
---

Require environments that support `WeakMap`, `WeakSet` and symbols. Apollo Client would fallback to `Map` and `Set` if the weak versions were not available. This has been removed and expects that these features are available in the source environment.

If you are running in an environment without `WeakMap`, `WeakSet` or symbols, you will need to find appropriate polyfills.
