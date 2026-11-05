---
"@apollo/client": patch
---

Fix an issue where an `AbortError` was thrown by `useReadQuery` when a `useBackgroundQuery` query is skipped, its `useReadQuery` component unmounts, and the query is then re-enabled in the same render that `useReadQuery` mounts again.
