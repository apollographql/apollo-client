---
"@apollo/client": patch
---

Fix an issue with `@stream` queries when using `returnPartialData: true` where the streamed list was truncated after the first incremental chunk when the list contained partial cache data. The list is no longer truncated and partial list items are now retained as incremental chunks arrive. The `dataState` is now reported as `partial` until the server has streamed enough of the list so that each list item fully satisfies the query.

This change also updates `@stream` queries so that they reported with `dataState: "complete` instead of `"streaming"` since it is safe to access all fields in the response.
