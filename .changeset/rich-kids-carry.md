---
"@apollo/client": major
---

Fix type of `data` property on `ApolloQueryResult`. Previously this field was non-optional, non-null `TData`, however at runtime this value could be set to `undefined`. This field is now reported as `TData | undefined`.
