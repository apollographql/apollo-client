---
"@apollo/client": patch
---

Fix issue where calling `fetchMore` with a different query while data masking was enabled might to to mask the result with the wrong query document.
