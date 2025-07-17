---
"@apollo/client": major
_tags:
  - ObservableQuery
  - errors
---

`ObservableQuery` will no longer terminate on errors and will instead emit a `next` value with an `error` property. This ensures that `ObservableQuery` instances can continue to receive updates after errors are returned in requests without the need to resubscribe to the observable.
