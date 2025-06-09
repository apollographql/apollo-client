---
"@apollo/client": minor
---

Add the new `ClientAwarenessLink`.

This link is already included in `HttpLink` and `BatchHttpLink` to enable the
"client awareness" and "enhanced client awareness" features, but you can also use
`ClientAwarenessLink` directly in your link chain to combine it with other
terminating links.

If you want to save the bundle size that `ClientAwarenessLink` adds to `HttpLink`
and `BatchHttpLink`, you can use `BaseHttpLink` or `BaseBatchHttpLink` instead.
These links come without the `ClientAwarenessLink` included.
