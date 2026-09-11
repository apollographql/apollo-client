---
"@apollo/client": minor
---

Fix the accuracy of `dataState` in complex incremental streaming scenarios, especially when combined with `returnPartialData: true`.

Prior to this change, all intermediate chunks used for both `@defer` and `@stream` directives returned a `dataState` of `streaming`, regardless of whether the actual data shape fit the definition of the `streaming` data state. The `streaming` data state represents an incomplete incremental response where the only holes in the data occur at `@defer` boundaries.

Let's use the following example of where the previous `dataState` fell down when combined with `returnPartialData`.

```gql
query GreetingQuery {
  greeting {
    message
    ... @defer {
      recipient {
        name
        email
      }
    }
  }
}
```

1. Scenario 1: partial data inside a `@defer` boundary written to the cache

Let's say the cache contained the following partial data:

```ts
{
  greeting: {
    __typename: "Greeting",
    recipient: {
      __typename: "Person",
      name: "John Doe",
    },
  },
};
```

After the first chunk arrives from the server, the data looks like the following:

```ts
{
  greeting: {
    __typename: "Greeting",
    message: "Hello, John",
    recipient: {
      __typename: "Person",
      name: "John Doe",
    },
  },
};
```

This data is not `complete` because `recipient.email` is missing. This data is also not `streaming` because the data requirements in the `@defer` boundary are partially fulfilled due to the existence of `recipient`. This could lead to runtime crashes on `recipient.email` if you use the existence of `recipient` to detect whether data in the `@defer` boundary has streamed in or not. This change now accurately reports this as `partial` to ensure the field is marked as a partial field in `recipient`.

2. Scenario 2: partial data written to the cache that fulfills the data requirements of the `@defer` boundary

Let's say the cache contained the following partial data:

```ts
{
  greeting: {
    __typename: "Greeting",
    recipient: {
      __typename: "Person",
      name: "John Doe",
      email: "john@example.com",
    },
  },
};
```

After the first chunk arrives from the server, the data looks like the following:

```ts
{
  greeting: {
    __typename: "Greeting",
    message: "Hello, John",
    recipient: {
      __typename: "Person",
      name: "John Doe",
      email: "john@example.com",
    },
  },
};
```

In this case, the combination of the first chunk and the partial data in the cache now fulfills the data requirements of the query. Even though the server is still streaming data (`NetworkStatus.streaming`), we can report this as `dataState: "complete"` since it is safe to access data on all fields.

This change also means `@stream` queries by definition fulfill the data requirements of the query after the first chunk arrives since `@stream` operates on lists and contains no data holes. `@stream` queries now accurately report `dataState` as `complete` or `partial`, depending on whether the list mixes partial data with streamed list items.

As a result of this change, some cases where you'd previously see `dataState` reported as `"streaming"` are now reported as `partial` or `complete`.

If you use `dataState` to determine whether an incremental request is still in-flight, please use `networkStatus` instead to check for `NetworkStatus.streaming`. `dataState` is type narrowing feature and not intended to report the network status.
