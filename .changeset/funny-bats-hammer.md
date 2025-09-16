---
"@apollo/client": patch
---

Fix an issue where calling `fetchMore` with `@defer` or `@stream` would not rerender incremental results as they were streamed.
