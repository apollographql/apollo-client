---
"@apollo/client": major
---

`never` is no longer supported as a valid `TVariables` generic argument for APIs that require `variables` as part of its type. Use `Record<string, never>` instead.
