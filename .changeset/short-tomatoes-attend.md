---
"@apollo/client": major
---

Remove `TContext` generic argument from all types that use it. `TContext` is replaced with `DefaultContext` which can be modified using declaration merging.
