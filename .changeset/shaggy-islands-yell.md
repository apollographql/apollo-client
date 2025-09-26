---
"@apollo/client": patch
---

Warn when using a `no-cache` fetch policy without a local resolver defined. `no-cache` queries do not read or write to the cache which meant `no-cache` queries are silently incomplete when the `@client` field value was handled by a cache `read` function.
