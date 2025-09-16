---
"@apollo/client": minor
---

Add support for the `@stream` directive on both the `Defer20220824Handler` and the `GraphQL17Alpha2Handler`.

> [!NOTE]
> The implementations of `@stream` differ in the delivery of incremental results between the different GraphQL spec versions. If you upgrading from the older format to the newer format, expect the timing of some incremental results to change.
