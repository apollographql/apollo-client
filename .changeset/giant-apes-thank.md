---
"@apollo/client": major
_tags:
  - links
  - removals
---

Remove the `onError` and `setOnError` methods from `ApolloLink`. `onError` was only used by `MockLink` to rewrite errors if `setOnError` was used.
