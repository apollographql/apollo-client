---
"@apollo/client": patch
_tags:
  - removals
---

`client.query` no longer supports `notifyOnNetworkStatusChange` in options. An error will be thrown if this option is set. The effects of this option were not observable by `client.query` since `client.query` emits a single result.
