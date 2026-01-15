---
"@apollo/client": patch
---

Fix an issue where errors parsed from incremental chunks in `ErrorLink` might throw when using the `GraphQL17Alpha9Handler`.
