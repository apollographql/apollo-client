---
"@apollo/client": patch
---

Allow queryRefs to be disposed of synchronously when a suspense hook unmounts.
This prevents some situations where using a suspense hook with the same
query/variables as the disposed queryRef accidentally used the disposed queryRef
rather than creating a new instance.
