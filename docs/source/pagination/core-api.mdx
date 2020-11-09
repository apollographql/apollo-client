---
title: Core pagination API
sidebar_title: Core API
description: Fetching and caching paginated results
---

The Apollo Client APIs described in this article are useful for handling all paginated list fields, regardless of which pagination strategy a field uses.

## The `fetchMore` function

Pagination always involves sending followup queries to your GraphQL server to obtain additional pages of results. In Apollo Client, the recommended way to send these followup queries is with the [`fetchMore`](../caching/advanced-topics/#incremental-loading-fetchmore) function. This function is a member of the `ObservableQuery` object returned by `client.watchQuery`, and it's also included in the object returned by the `useQuery` hook:

```js
const { loading, data, fetchMore } = useQuery(GET_ITEMS, { //highlight-line
  variables: {
    offset: 0,
    limit: 10
  },
});
```

When you then call `fetchMore`, you can provide a new set of `variables` in the function's `options` object (such as a new `offset`):

```js
fetchMore({
  variables: {
    offset: 10,
    limit: 10
  },
});
```

In addition to `variables`, you can also optionally provide an entirely different shape of `query` to execute, which can be useful when `fetchMore` needs to fetch only a single field, but the original query contained other unrelated fields. By default, the original query's shape is reused.

> In Apollo Client 2, you would also provide `fetchMore` an `updateQuery` function, which was responsible for merging the followup query's results with your existing cached data. In Apollo Client 3, you instead [define custom `merge` functions](#merging-paginated-results). This enables you to specify all of your pagination logic in a central location, instead of duplicating it everywhere you call `fetchMore`.

Full examples of using `fetchMore` are provided in the detailed documentation for [offset-based pagination](./offset-based) and [cursor-based pagination](./cursor-based). The rest of this article covers the field policy configuration API that allows application code to call `fetchMore` without worrying about how incoming data is combined with existing data.

## Merging paginated results

> The example below uses offset-based pagination, but this article applies to all pagination strategies.

To specify which page of a list field you want to fetch, you usually pass an argument for that field, such as `offset` or `cursor`. This argument's value is different for each query that fetches a different page of the list.

Without any special configuration, `InMemoryCache` has no understanding of what these arguments mean, so it stores a separate value for each unique combination of arguments. If you examine the internal cache data for a field with arguments, you typically see those arguments serialized and appended to the end of the field name string. This allows multiple distinct values to be stored for a single field within a single entity object.

Although this argument-based separation is the safest default policy in most cases, it usually _isn't_ what you want when implementing pagination, because differences in arguments like `offset` and `limit` describe different parts of the same underlying data, rather than entirely separate pieces of data. When dealing with paginated data, it's more convenient for all returned pages to be merged into a _single_ list in your cache. To achieve this behavior, you can configure a **field policy** for the paginated field.

### Defining a field policy

A field policy specifies how a particular field in your `InMemoryCache` is read and written. You can define a field policy to merge the results of paginated queries into a single list.

#### Example

Here's the server-side schema for a message feed application that uses offset-based pagination:

```graphql{2}
type Query {
  feed(offset: Int, limit: Int): [FeedItem!]
}

type FeedItem {
  id: String!
  message: String!
}
```

In our client, we want to define a field policy for `Query.feed` so that all returned pages of the list are merged into a _single_ list in our cache.

We define our field policy within the `typePolicies` option we provide the `InMemoryCache` constructor:

```js{5-15}
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          // Don't cache separate results based on
          // any of this field's arguments.
          keyArgs: false,

          // Concatenate the incoming list items with
          // the existing list items.
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        }
      }
    }
  }
})
```

This field policy specifies the field's `keyArgs`, along with a **`merge` function**. Both of these configurations are necessary for handling pagination:

* `keyArgs` specifies a list of arguments (if any) that cause the cache to store a _separate_ field value for each unique combination of those arguments.
  * In this case, the cache shouldn't store a separate result based on _any_ of its arguments (`offset` or`limit`), so we disable this behavior entirely by passing `false`. An empty list (`keyArgs: []`) also works, but `keyArgs: false` is more expressive, and it results in a field key that is simply the name of the field (`feed` in this case).
  * Whenever a particular argument's value could cause items from an _entirely different list_ to be returned for the field, the name of that argument _should_ be included in `keyArgs`.
  * For more information, see [Specifying key arguments](../caching/cache-field-behavior/#specifying-key-arguments) and [The `keyArgs` API](./key-args).
* A `merge` function tells the Apollo Client cache how to combine `incoming` data with `existing` cached data for a particular field. Without this function, incoming field values simply _overwrite_ existing field values by default.
  * For more information, see [The `merge` function](../caching/cache-field-behavior/#the-merge-function).

With this field policy in place, Apollo Client merges the results of all queries that use the following structure, regardless of argument values:

```ts
// Client-side query definition
const FEED_QUERY = gql`
  query Feed($offset: Int, $limit: Int) {
    feed(offset: $offset, limit: $limit) {
      id
      message
    }
  }
`;
```

### Designing the `merge` function

In [the example above](#example), our `merge` function is a single line:

```js
merge(existing = [], incoming) {
  return [...existing, ...incoming];
}
```

This function makes risky assumptions about the order in which the client requests pages, because it ignores the values of `offset` and `limit`. A more robust `merge` function can use `options.args` to decide where to put `incoming` data relative to `existing` data, like so:

```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          keyArgs: [],
          merge(existing, incoming, { args: { offset = 0 }}) {
            // Slicing is necessary because the existing data is
            // immutable, and frozen in development.
            const merged = existing ? existing.slice(0) : [];
            for (let i = 0; i < incoming.length; ++i) {
              merged[offset + i] = incoming[i];
            }
            return merged;
          },
        },
      },
    },
  },
});
```

This logic handles sequential page writes the same way the single-line strategy does, but it can also tolerate repeated, overlapping, or out-of-order writes, without duplicating any list items.

## `read` functions for paginated fields

As shown above, a `merge` function helps you combine paginated query results from your GraphQL server into a single list in your client cache. But what if you also want to configure how that locally cached list is _read_? For that, you can define a **`read` function**.

You define a `read` function for a field within its [field policy](#defining-a-field-policy), alongside the `merge` function and `keyArgs`. If you define a `read` function for a field, the cache calls that function whenever you query the field, passing the field's existing cached value (if any) as the first argument. In the query response, the field will be populated with the `read` function's return value, instead of the existing data.

> If a field policy includes both a `merge` function and a `read` function, the default value of `keyArgs` becomes `false` (i.e., _no_ arguments are key arguments). If either function _isn't_ defined, _all_ of the field's arguments are considered key arguments by default. In either case, you can define `keyArgs` yourself to override the default behavior.

A `read` function for a paginated field typically uses one of the following approaches:

* [Re-pagination](#paginated-read-functions), in which the cached list is split back into pages, based on field arguments
* [_No_ pagination](#non-paginated-read-functions), in which the cached list is always returned in full

Although the "right" approach varies from field to field, a [non-paginated `read` function](#non-paginated-read-functions) often works best for infinitely scrolling feeds, since it gives your application code full control over which elements to display at a given time, without requiring any additional cache reads.

### Paginated `read` functions

The `read` function for a list field can perform client-side re-pagination for that list. It can even transform a page before returning it, such as by sorting or filtering its elements.

This capability goes beyond returning the same pages that you fetched from your server, because a `read` function for `offset`/`limit` pagination could read from any available `offset`, with any desired `limit`:

```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          read(existing, { args: { offset, limit }}) {
            // A read function should always return undefined if existing is
            // undefined. Returning undefined signals that the field is
            // missing from the cache, which instructs Apollo Client to
            // fetch its value from your GraphQL server.
            return existing && existing.slice(offset, offset + limit);
          },

          // The keyArgs list and merge function are the same as above.
          keyArgs: [],
          merge(existing, incoming, { args: { offset = 0 }}) {
            const merged = existing ? existing.slice(0) : [];
            for (let i = 0; i < incoming.length; ++i) {
              merged[offset + i] = incoming[i];
            }
            return merged;
          },
        },
      },
    },
  },
});
```

Depending on the assumptions you feel comfortable making, you might want to make this code more defensive. For example, you can provide default values for `offset` and `limit`, in case someone fetches `Query.feed` without providing arguments:

```js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          read(existing, {
            args: {
              // Default to returning the entire cached list,
              // if offset and limit are not provided.
              offset = 0,
              limit = existing?.length,
            } = {},
          }) {
            return existing && existing.slice(offset, offset + limit);
          },
          // ... keyArgs, merge ...
        },
      },
    },
  },
});
```

This style of `read` function takes responsibility for re-paginating your data based on field arguments, essentially inverting the behavior of your `merge` function. This way, your application can query different pages using different arguments.

### Non-paginated `read` functions

The `read` function for a paginated field can choose to _ignore_ arguments like `offset` and `limit`, and always return the entire list as it exists in the cache. In this case, your application code takes responsibility for slicing the list into pages depending on your needs.

If you adopt this approach, you might not need to define a `read` function at all, because the cached list can be returned without any processing. That's why the [`offsetLimitPagination` helper function](./offset-based/#the-offsetlimitpagination-helper) is implemented _without_ a `read` function.

Regardless of how you configure `keyArgs`, your `read` (and `merge`) functions can always examine any arguments passed to the field using the `options.args` object. See [The `keyArgs` API](./key-args) for a deeper discussion of how to reason about dividing argument-handling responsibility between `keyArgs` and your `read` or `merge` functions.
