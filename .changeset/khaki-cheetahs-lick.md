---
"@apollo/client": patch
---

Fixes an issue where calling `observableQuery.getCurrentResult()` when the `errorPolicy` was set to `all` would return the `networkStatus` as `NetworkStatus.ready` when there were errors returned in the result. This has been corrected to report `NetworkStatus.error`.

This bug also affected `useQuery` and may affect you if you check for `networkStatus` in your component.
