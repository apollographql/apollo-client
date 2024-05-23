---
"@apollo/client": patch
---

Fixes [#11849](https://github.com/apollographql/apollo-client/issues/11849) by reevaluating `window.fetch` each time `BatchHttpLink` uses it, if not configured via `options.fetch`. Takes the same approach as PR [#8603](https://github.com/apollographql/apollo-client/pull/8603) which fixed the same issue in `HttpLink`.
