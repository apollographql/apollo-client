---
"@apollo/client": patch
---

Speed up cache writes by avoiding a full AST `visit` of every written field to detect `@stream`. The check now runs only when the result carries stream info, and only inspects the field node's own directives. As a result, fields that merely contain `@stream` on a nested field are no longer treated as streamed themselves and now overwrite existing lists like regular fields instead of merging chunk-wise.
