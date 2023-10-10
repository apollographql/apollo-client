---
"@apollo/client": patch
---

Start the query ref auto dispose timeout after the initial promise has settled. This prevents requests that run longer than the timeout duration from keeping the component suspended indefinitely.
