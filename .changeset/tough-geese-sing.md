---
"@apollo/client": patch
---

Remove double initialization of initial useFragment value that was unnecessary. This also reduces bundle size by removing an unneeded internal hook as a result.
