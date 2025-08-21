---
"@apollo/client": major
_tags:
  - links
  - types
---

The `operation` argument to the callback passed to `SetContextLink` is now of type `SetContextLink.SetContextOperation` which is an `Operation` without the `getContext` or `setContext` functions. Previously the type of `operation` was `GraphQLRequest` which had access to a `context` property. The `context` property was always `undefined` and could result in bugs when using it instead of the `prevContext` argument.

This change means the `operation` argument now contains an accessible `client` property.
