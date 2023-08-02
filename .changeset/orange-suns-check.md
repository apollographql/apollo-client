---
'@apollo/client': patch
---

Incrementally re-render deferred queries after calling `refetch` or setting `skip` to `false` to match the behavior of the initial fetch. Previously, the hook would not re-render until the entire result had finished loading in these cases.
