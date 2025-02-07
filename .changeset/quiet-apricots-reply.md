---
"@apollo/client": patch
---

In case of a multipart response (e.g. with `@defer`), query deduplication will
now keep going until the final chunk has been received.
