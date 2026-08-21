---
"@apollo/client": minor
---

Change when `@defer` fragments and `@stream` fields are pruned for `cache-first` and `cache-and-network` fetch policies to better match the network when the initial value contained a partial result:

- `cache-first`: prune undelivered `@defer` fragments or `@stream` items when the result is fetched from the network due to a partial result
- `cache-and-network`: prune undelivered `@defer` fragments or `@stream` items if the initial cache value was partial. If the first value emitted from the cache is complete, the results will not be pruned.

This makes the emitted results more predictable by following what the network has delivered and avoids some ambiguity in other edge cases.

For example, with a `cache-first` fetch policy where all `@defer` fields are written to the cache, but a non-deferred field is partial, the values emitted from the client previously looked like the following:

```graphql
query {
  user {
    id
    name
    ... @defer {
      email
    }
  }
}
```

```ts
// data written to the cache is missing name
{ user: { id: 1, email: "user.cache@example.com" }}

// 1. empty because the result is partial
{ data: undefined, dataState: "empty", ... }
// 2. returns all data because the cache contains a value for email
{ data: { user: 1, name: "User", email: "user.cache@example.com" }, dataState: "complete" }
// 3. email updated from the server
{ data: { user: 1, name: "User", email: "user.network@example.com" }, dataState: "complete" }
```

Here the result is confusing because the initial value returned from the query was `undefined`, yet a complete result was returned after the initial chunk from the network returned (which did not contain `email`).

The cache values are now pruned if the network hasn't delivered them yet:

```ts
// 1. empty because the result is partial
{ data: undefined, dataState: "empty" }
// 2. email hasn't been delivered by the network so it gets pruned
{ data: { user: 1, name: "User" }, dataState: "streaming" }
// 3. full result returned after the network streams the email field
{ data: { user: 1, name: "User", email: "user.network@example.com" }, dataState: "complete" }
```

This is especially helpful in situations where `@defer` boundaries that are never delivered due to errors prevent an awkward situation where the client would otherwise have to choose whether to serve the stale cache result from the cache, or prune the undelivered fragment on the final chunk.
