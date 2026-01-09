---
"@apollo/client": patch
---

Change the returned value from `null` to `{}` when all fields in a query were skipped.

This also fixes a bug where `useSuspenseQuery` would suspend indefinitely when all fields were skipped.
