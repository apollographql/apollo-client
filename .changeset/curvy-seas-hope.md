---
"@apollo/client": minor
---

Simplify RetryLink, fix potential memory leak

Historically, `RetryLink` would keep a `values` array of all previous values,
in case the operation would get an additional subscriber at a later point in time.
In practice, this could lead to a memory leak (#11393) and did not serve any
further purpose, as the resulting observable would only be subscribed to by
Apollo Client itself, and only once - it would be wrapped in a `Concast` before
being exposed to the user, and that `Concast` would handle subscribers on its
own.
