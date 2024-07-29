---
"@apollo/client": patch
---

Fix issue where executing `fetchMore` with a `no-cache` fetch policy could sometimes result in multiple network requests.
