---
"@apollo/client": patch
_tags:
  - defer
---

Slightly rework multipart response parsing.

This removes last incremental-protocol-specific details from `HttpLink` and `BatchHttpLink`.
