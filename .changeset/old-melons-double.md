---
"@apollo/client": major
---

Rework option handling for `fetchMore`.

* Previously, if the `query` option was specified, no options would be inherited
from the underlying `ObservableQuery`.
Now, even if `query` is specified, all unspecified options except for `variables` will be inherited from the underlying `ObservableQuery`.
* If `query` is not specified, `variables` will still be shallowly merged with the `variables` of the underlying `ObservableQuery` (this also was the previous behaviour).
* `errorPolicy` of `fetchMore` will now always default to `"none"` instead of being inherited.
