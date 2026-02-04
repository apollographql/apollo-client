---
"@apollo/client": patch
---

Fix PersistedQueryLink to preserve existing http and fetchOptions context instead of overwriting them, which broke @defer support with GraphQL17Alpha9Handle, etc..
