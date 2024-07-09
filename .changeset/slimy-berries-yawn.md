---
"@apollo/client": patch
---

Changes usages of the `GraphQLError` type to `GraphQLFormattedError`.

This was a type bug - these errors were never `GraphQLError` instances
to begin with, and the `GraphQLError` class has additional properties that can
never be correctly rehydrated from a GraphQL result.
The correct type to use here is `GraphQLFormattedError`.
