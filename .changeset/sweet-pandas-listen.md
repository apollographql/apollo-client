---
"@apollo/client": minor
---

Add a `localized` error policy. With `errorPolicy: "localized"`, the operation receives the full response shape along with `error`, just like `all`, but the fields that GraphQL errors point at are left out of the cache write. Everything that resolved successfully is written and broadcast as usual, so a failing field no longer overwrites shared cache data with `null` for the rest of the app.

`Cache.WriteOptions` and `Cache.WriteQueryOptions` gain a matching `skipPaths` option for callers that write to the cache directly.
