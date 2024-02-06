---
"@apollo/client": patch
---

Fix issue in `useLazyQuery` that results in a double network call when calling the execute function with no arguments after having called it previously with another set of arguments.
