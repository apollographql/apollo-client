---
'@apollo/client': minor
---

`HttpLink`/`BatchHttpLink`: Abort AbortController signal more granularly.
Before this change, when `HttpLink`/`BatchHttpLink` created an `AbortController`
internally, that would always be `.abort`ed after the request was finished in any
way.
This could cause issues with Sentry Session Replay and Next.js App Router Cache
invalidations, which just replayed the fetch with the same options - including the
cancelled `AbortSignal`.
With this change, the `AbortController` will only be `.abort()`ed by outside events,
not as a consequence of the request finishing or erroring.
