---
'@apollo/client': patch
---

Fix an issue where a call to `refetch`, `fetchMore`, or changing `skip` to `false` that returned a result deeply equal to data in the cache would get stuck in a pending state and never resolve.
