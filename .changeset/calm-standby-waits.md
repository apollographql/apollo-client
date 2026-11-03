---
"@apollo/client": patch
---

Fix an issue where `useQuery` stayed in a loading state forever when `skip` became `true` (or the options became `skipToken`) while the request was still in flight. `getCurrentResult()` now returns `loading: false` when `reobserve` switches the query to `standby` while a request is in flight.
