---
"@apollo/client": major
---

Remove the check and warning for `cache.fragmentMatches` when applying data masking. `cache.fragmentMatches` is a required API and data masking may crash when `cache.fragmentMatches` does not exist.
