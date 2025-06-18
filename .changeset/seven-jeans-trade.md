---
"@apollo/client": minor
---

Added a new `.stop` function on `ObservableQuery`.
Calling this method will unsubscribe all current subscribers by sending a `complete` event from the observable and tear down the `ObservableQuery`.
