---
"@apollo/client": patch
---

The `fetchOptions` option provided to `HttpLink` and `BatchHttpLink` is now `RequestInit` instead of `any`. The `credentials` option is now a `RequestCredentials` type instead of a `string`.
