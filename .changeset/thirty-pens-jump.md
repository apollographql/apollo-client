---
"@apollo/client": major
_tags:
  - ApolloClient
  - removals
  - LocalState
---

Remove the `fragmentMatcher` option from `ApolloClient`. Custom fragment matchers used with local state are no longer supported. Fragment matching is now performed by the configured `cache` via the `cache.fragmentMatches` API.
