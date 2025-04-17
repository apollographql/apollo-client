---
"@apollo/client": major
---

`client.query` no longer supports a `fetchPolicy` of `standby`. `standby` does not fetch and did not return `data`. `standby` is meant for watched queries where fetching should be on hold.
