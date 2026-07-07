---
"@apollo/client": patch
---

Fix an issue where custom scalars returned in intermediate incremental `@defer` payloads did not return the parsed scalar value.
