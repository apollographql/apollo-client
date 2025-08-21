---
"@apollo/client": major
_tags:
  - fetchMore
---

Rework option handling for `fetchMore`.

* Previously, if the `query` option was specified, no options would be inherited
from the underlying `ObservableQuery`.
Now, even if `query` is specified, all unspecified options except for `variables` will be inherited from the underlying `ObservableQuery`.
* If `query` is not specified, `variables` will still be shallowly merged with the `variables` of the underlying `ObservableQuery`. If a `query` option is specified, the `variables` passed to `fetchMore` are used instead.
* `errorPolicy` of `fetchMore` will now always default to `"none"` instead of inherited from the `ObservableQuery` options. This can prevent accidental cache writes of partial data for a paginated query. To opt into receive partial data that may be written to the cache, pass an `errorPolicy` to `fetchMore` to override the default.
