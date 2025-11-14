---
"@apollo/client": minor
---

Fix an issue where deferred payloads that returned arrays with fewer items than the original cached array would retain items from the cached array. This change includes `@stream` arrays where stream arrays replace the cached arrays.
