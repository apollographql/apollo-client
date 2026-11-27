---
"@apollo/client": patch
---

Deliver the merged cache result before `fetchMore` resolves so a `fetchMore` started right after it reads the current result instead of the stale one. Previously the second call requested the same page again when the cache notification landed while the new operation was running.
