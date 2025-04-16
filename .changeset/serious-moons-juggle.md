---
"@apollo/client": patch
---

`client.query` no longer supports `notifyOnNetworkStatusChange` in options. An error will be thrown if this option is set. This option was not observable since
`client.query` emits a single result when it has finished loading.

