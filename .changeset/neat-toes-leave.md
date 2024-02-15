---
"@apollo/client": patch
---

Fix issue where partial data is reported to `useQuery` when using `notifyOnNetworkStatusChange` after it errors while another overlapping query succeeds.
