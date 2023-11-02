---
"@apollo/client": patch
---

#11206 used the TypeScript syntax `infer X extends Y` that was introduced in TS 4.8.
This caused some problems for some users, so we are rolling back to a more backwars-compatible (albeit slightly less performant) type.
