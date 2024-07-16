---
"@apollo/client": patch
---

Slightly reduce bundle size by making all `QueryManager` constructor arguments required.
(`QueryManager` is an internal API, so this change has no consequences for userland code.)
