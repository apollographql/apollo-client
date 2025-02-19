---
"@apollo/client": major
---

`ObservableQuery` will no longer terminates on errors and will instead emit a `next` value with an `error` property. This ensures that `ObservableQuery` instances can continue to receive updates after errors are returned in requests without the need to resubscribe to the observable.
