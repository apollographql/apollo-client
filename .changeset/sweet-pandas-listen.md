---
"@apollo/client": minor
---

Add a `localized` error policy. For GraphQL errors in the response body the operation receives the full response shape along with `error`, just like `all`, but the fields those errors name in their `path` are left out of the cache write. Everything that resolved successfully is written and broadcast as usual, so a failing field no longer overwrites shared cache data with `null` for the rest of the app.

A network or transport error — one that fails the whole operation rather than arriving in the response body — behaves like `none` instead, since there is no response shape to hand back and emitting an empty result would clear data the caller is already rendering.

`Cache.WriteOptions` and `Cache.WriteQueryOptions` gain a matching `skipPaths` option for callers that write to the cache directly.
