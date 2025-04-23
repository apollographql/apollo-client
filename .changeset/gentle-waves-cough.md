---
"@apollo/client": major
---

The `cache` and `forceFetch` properties are no longer available on context when calling `operation.getContext()`. `cache` can be accessed through the `operation` with `operation.client.cache` instead. `forceFetch` has been replaced with `queryDeduplication` which specifies whether `queryDeduplication` was enabled for the request or not.
