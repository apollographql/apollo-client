---
"@apollo/client": patch
---

Fix an issue where errors returned from a `fetchMore` call from a Suspense hook would cause a Suspense boundary to be shown indefinitely.
