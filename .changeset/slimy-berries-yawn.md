---
"@apollo/client": patch
---

Changes usages of the `GraphQLError` type to `GraphQLFormattedError`.

This was a type bug - these errors were never `GraphQLError` instances
to begin with, and the `GraphQLError` class has additional properties that can
never be correctly rehydrated from a GraphQL result.
The correct type to use here is `GraphQLFormattedError`.

Similarly, please ensure to use the type `FormattedExecutionResult`
instead of `ExecutionResult` - the non-"Formatted" versions of these types
are for use on the server only, but don't get transported over the network.
