---
"@apollo/client": patch
---

Refactor `removeDirectivesFromDocument` to fix AST ordering sensitivities and avoid 1/3 AST traversals, potentially improving performance for large queries
