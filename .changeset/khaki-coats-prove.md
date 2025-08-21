---
"@apollo/client": major
_tags:
  - links
---

The new `SetContextLink` flips the `prevContext` and `operation` arguments in the callback. The `setContext` function has remained unchanged.

```diff
- new SetContextLink((operation, prevContext) => {
+ new SetContextLink((prevContext, operation) => {
  // ...
})
```
