---
'@apollo/client': patch
---

Fix an issue where cache updates would not propagate to `useSuspenseQuery` while in strict mode.
