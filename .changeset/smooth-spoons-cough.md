---
"@apollo/client": patch
---

Fix an issue where a polled query created in React strict mode may not stop polling after the component unmounts while using the `cache-and-network` fetch policy.
