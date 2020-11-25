---
title: The keyArgs API
sidebar_title: keyArgs
---

> We recommend reading [Core pagination API](./core-api) before learning about considerations specific to the `keyArgs` configuration.

In GraphQL, a single field within a single object may store multiple different values at once, corresponding to different combinations of field arguments passed to the field in a given request. This multiplicity of field values requires the cache to store the values separately, so that they can be retrieved separately in the future.

There are many ways this storage could be structured, but `InMemoryCache` represents each entity object as a `StoreObject`, which is an ordinary JavaScript object with string keys generated from the name of the field plus the serialized arguments (if any), rather than using just the name of the field. Fields without arguments are keyed by their field names alone.

By default, `InMemoryCache` incorporates _all_ field arguments into the storage key for each field, so a single field can simultaneously hold as many different values as the number of unique combinations of arguments. This default strategy sacrifices the hit rate of the cache in order to avoid reusing field values inappropriately when any of the arguments are not the same.

However, in many cases, you may realize that your field values are more reusable than this default strategy assumes, and some or all of the arguments are not actually relevant to the storage identity of the field. Fortunately, this system is configurable.

In addition to `merge` and `read` functions, `InMemoryCache` field policies can contain a configuration called [`keyArgs`](../caching/cache-field-behavior#specifying-key-arguments), which specifies an array of argument names whose values should be serialized and appended to the field name to create a distinct storage key for a particular value of the field to be stored in the cache.

A `keyArgs: ["type"]` field policy configuration means `type` is the only argument the cache should consider (in addition to the field name and the identity of the enclosing object) when accessing values for this field. A `keyArgs: false` configuration disables the whole system of differentiating field values by arguments, so the field's value will be identified only by the field's name (within some `StoreObject`), without any serialized arguments appended to it.

> In the unlikely event that a `keyArgs` array is insufficient to specify the storage key, you can alternatively pass a function for `keyArgs`, which allows you to sanitize and serialize the `args` object however you like.

This article provides specific technical guidance on choosing appropriate `keyArgs` configurations, especially when working with paginated fields and field policies.

## Which arguments belong in `keyArgs`?

Throughout this area of the documentation, you'll find a number of possible `keyArgs` configurations, ranging from including all arguments by default, to completely disabling argument-based field identification using `keyArgs: false`. To understand which arguments belong in `keyArgs` (if any), it's helpful to consider those two extremes first&mdash;including all arguments in the field key, or none of them&mdash;because those are the most common cases. Building on that understanding, we can then discuss the consequences of moving an individual argument into or out of `keyArgs`.

If you include all arguments in the field key, as `InMemoryCache` does by default, then every different combination of argument values will correspond to a different storage location for internal field data. In other words, if you change any argument values, the field key will be different, so the field value will be stored in a different location. In your `read` and `merge` functions, this internal field data is provided by the `existing` parameter, which will be undefined when a particular combination of arguments has never been seen before. With this approach, the cache can reuse field values only if the arguments exactly match, which significantly reduces the hit rate of the cache, but also keeps the cache from inappropriately reusing field values when differences in arguments actually matter.

On the other hand, if you configure your field with `keyArgs: false`, the field key will always be just the field name, without any extra characters appended to it. Because your `read` and `merge` functions have access to the field arguments via `options.args`, you could use `read` and `merge` to keep your internal data separated according to the arguments, simulating the behavior of `keyArgs` without actually using `keyArgs`. Your `read` function then gets to decide whether an existing field value can be reused, and how it should be transformed before it is reused, based on the runtime argument values and whatever internal value was previously stored.

For example, we could have used `keyArgs: false` instead of `keyArgs: ["type"]` for our `Query.feed` field policy:

```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          keyArgs: false,

          read(existing = {}, { args: { type, offset, limit }}) {
            return existing[type] &&
              existing[type].slice(offset, offset + limit);
          },

          merge(existing = {}, incoming, { args: { type, offset = 0 }}) {
            const merged = existing[type] ? existing[type].slice(0) : [];
            for (let i = 0; i < incoming.length; ++i) {
              merged[offset + i] = incoming[i];
            }
            existing[type] = merged;
            return existing;
          },
        },
      },
    },
  },
});
```

Instead of a single array, `existing` is now a map from `type`s to feeds, allowing a single field value to store multiple feed arrays, separated by `type`. However, this manual separation is logically equivalent to what would happen if you moved the `type` argument into `keyArgs` (using `keyArgs: ["type"]`, as above), so the extra effort is probably unnecessary. Assuming feeds with different `type` values have different data, and assuming our `read` function does not need simultaneous access to multiple feeds of different types, we can safely shift the responsibility for handling the `type` argument from the `read` and `merge` functions back to `keyArgs`, and simplify `read` and `merge` to handle only one feed at a time.

In short, if the logic for storing and retrieving field data is the same for different values of a given argument (like `type`), and those field values are logically independent from one another, then you probably should move that argument into `keyArgs`, to save yourself from having to deal with it in your `read` and `merge` functions.

By contrast, arguments that limit, filter, sort, or otherwise reprocess existing field data usually do not belong in `keyArgs`, because putting them in `keyArgs` makes field storage keys more diverse, reducing cache hit rate and limiting your ability to use different arguments to retrieve different views of the same data (without making a additional network requests).

As a general rule, `read` and `merge` functions can do almost anything with your field data, but there might be a less powerful tool (like `keyArgs`) that allows you to simplify (or avoid writing) custom `read` or `merge` functions. Whenever you have a choice between two capable tools, you should prefer the one that minimizes the total complexity of your code, which often favors a more limited, declarative API like `keyArgs`, over the unlimited power of functions like `merge` or `read`.

## The `@connection` directive

The `@connection` directive is a Relay-inspired convention that Apollo Client supports, though we now recommend `keyArgs` instead, because you can achieve the same effect with a single `keyArgs` configuration, whereas the `@connection` directive needs to be repeated in every query you send to your server.

In other words, whereas Relay encourages the following `@connection(...)` directive for `Query.feed` queries:
```js
const FEED_QUERY = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    feed(type: $type, offset: $offset, limit: $limit) @connection(
      key: "feed",
      filter: ["type"]
    ) {
      edges {
        node { ... }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
```
in Apollo Client, you would use the following query:
```js
const FEED_QUERY = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    feed(type: $type, offset: $offset, limit: $limit) {
      edges {
        node { ... }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
```
and instead configure `keyArgs` in your `Query.feed` field policy:
```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          keyArgs: ["type"],
        },
      },
    },
  },
})
```
Although `keyArgs` (and `@connection`) are useful for more than just paginated fields, it's worth noting that `relayStylePagination` configures `keyArgs: false` by default. You can reconfigure this `keyArgs` behavior by passing an alternate value to `relayStylePagination`:
```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: relayStylePagination(["type"]),
      },
    },
  },
})
```
In the unlikely event that a `keyArgs` array is insufficient to capture the identity of a field, remember that you can pass a function for `keyArgs`, which allows you to serialize the `args` object however you want.
