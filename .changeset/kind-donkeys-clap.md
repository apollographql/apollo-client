---
"@apollo/client": patch
---

Honor the `@nonreactive` directive when using `cache.watchFragment` or the `useFragment` hook to avoid rerendering when using these directives.
