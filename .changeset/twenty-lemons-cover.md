---
'@apollo/client': patch
---

Improve performance of local resolvers by only executing selection sets that contain an `@client` directive. Previously, local resolvers were executed even when the field did not contain `@client`. While the result was properly discarded, the unncessary work could negatively affect query performance, sometimes signficantly.
