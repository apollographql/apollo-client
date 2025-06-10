---
"@apollo/client": major
---

A `@defer` query that has not yet finished streaming is now considered loading and thus the `loading` flag will be `true` until the response has completed. A new `NetworkStatus.streaming` value has been introduced and will be set as the `networkStatus` while the response is streaming.
