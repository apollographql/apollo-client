---
"@apollo/client": major
_tags:
  - ObservableQuery
---

Reworked the logic for then a loading state is triggered. If the link chain responds synchronously, a loading state will be omitted, otherwise it will be triggered.
If local resolvers are used, the time window for "sync vs async" starts as soon as `@exports` variables are resolved.
