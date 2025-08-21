---
"@apollo/client": minor
_tags:
  - ObservableQuery
---

Added a new `.stop` function on `ObservableQuery`.
Calling this method will unsubscribe all current subscribers by sending a `complete` event from the observable and tear down the `ObservableQuery`.
