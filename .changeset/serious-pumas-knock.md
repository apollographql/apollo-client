---
"@apollo/client": patch
---

Fix an issue where a cache write in the middle of polling would remain as the query value if future poll requests returned deep equal results to previous polling results.
