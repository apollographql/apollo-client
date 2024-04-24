---
"@apollo/client": patch
---

`RenderPromises`: use `canonicalStringify` to serialize `variables` to ensure query deduplication is properly applied even when `variables` are specified in a different order.
