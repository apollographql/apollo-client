---
"@apollo/client": patch
---

Fixes a bug in how multipart responses are read when using `@defer`. When reading a multipart body, `HttpLink` no longer attempts to parse the boundary (e.g. `"---"` or other boundary string) within the response data itself, only when reading the beginning of each mulitpart chunked message.
