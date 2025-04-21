---
"@apollo/client": major
---

The `cache` and `forceFetch` proeprties are no longer available on context when calling `operation.getContext()`. `cache` can be accessed by calling `operation.getApolloContext()` instead.
