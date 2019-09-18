---
title: Configuring the cache
---

Apollo Client uses a normalized, in-memory cache to dramatically speed up the
execution of queries that don't rely on real-time data. This article covers
cache setup and configuration.

## Installation

The `InMemoryCache` class resides in a different package from the Apollo Client
core. Make sure the `apollo-cache-inmemory` package is installed in your project:

```bash
npm install apollo-cache-inmemory --save
```

## Initializing the cache

You create an `InMemoryCache` object and provide it to the `ApolloClient` constructor
like so:

```js
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { ApolloClient } from 'apollo-client';

const client = new ApolloClient({
  link: new HttpLink(),
  cache: new InMemoryCache()
});
```

The `InMemoryCache` constructor accepts a variety of options described in
[Configuring the cache](#configuring-the-cache).

## Configuring the cache

You can provide a configuration object to the `InMemoryCache` constructor to
customize its behavior. This object supports the following fields:

| Name    | Type | Description    |
| ------- | -----| --------- |
| `addTypename`  | boolean | Indicates whether to add `__typename` to the document (default: `true`) |
| `dataIdFromObject` | function | A function that takes a data object and returns a unique identifier to be used when normalizing the data in the store. Learn more about how to customize `dataIdFromObject` in [Custom identifiers](#custom-identifiers). |
|`fragmentMatcher`| object | By default, the `InMemoryCache` uses a heuristic fragment matcher. If you are using fragments on unions and interfaces, you will need to use an `IntrospectionFragmentMatcher`. For more information, please read [our guide to setting up fragment matching for unions & interfaces](/data/fragments/#fragments-on-unions-and-interfaces). |
|`cacheRedirects`| object | A map of functions to redirect a query to another entry in the cache before a request takes place. This is useful if you have a list of items and want to use the data from the list query on a detail page where you're querying an individual item. More on that [here](#cache-redirects-with-cacheredirects). |

## Data normalization

The `InMemoryCache` normalizes query results before saving them to the cache by:

1. Splitting the results into individual objects
2. Assigning a unique identifier to each object
3. Storing the objects in a flattened data structure

### Assigning unique identifiers

#### Default identifiers

By default, the `InMemoryCache` attempts to generate a unique identifier for an object
by combining the object's `__typename` field with its `id` or `_id` field.

If an object doesn't specify a `__typename` or one of `id` or `_id`, `InMemoryCache`
falls back to using the object's path within its associated query (e.g., `ROOT_QUERY.allPeople.0` for the first record returned for an `allPeople` root query).
Avoid this fallback strategy whenever possible, because it scopes cached objects
to individual queries. This means that if multiple queries all return the same
object, each query inefficiently caches a separate instance of that object.

> **Warning:** Each object type you cache should either _always_ include an `id` 
> field or _never_ include an `id` field. `InMemoryCache` [throws an error](https://github.com/apollographql/apollo-client/blob/451482ff85d93e1738df31007f3c2a7f0fbe8cff/packages/apollo-cache-inmemory/src/__tests__/__snapshots__/writeToStore.ts.snap#L4) if it
> encounters an inconsistency in the presence or absence of this field for a 
> particular type.

#### Custom identifiers 

You can define a custom strategy for generating unique identifiers for cached
objects. To do so, provide the `dataIdFromObject` [configuration option](#configuring-the-cache)
 to the `InMemoryCache` constructor. This option is a function that takes in
 an object and returns a unique identifier for that object.

For example, if your object types all define a `key` field that you want to use
as a unique identifier, you could define `dataIdFromObject` like so:

```js
const cache = new InMemoryCache({
  dataIdFromObject: object => object.key || null
});
```

Note that `InMemoryCache` uses the exact string that `dataIdFromObject` returns.
If you want the unique identifier to include the object's `__typename` field, you
must include it as part of the function's logic.

You can use different logic to generate unique identifiers for each of your object
types by keying off of an object's `__typename` property, like so:

```js
import { InMemoryCache, defaultDataIdFromObject } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  dataIdFromObject: object => {
    switch (object.__typename) {
      case 'foo': return object.key; // use the `key` field as the identifier
      case 'bar': return `bar:${object.blah}`; // append `bar` to the `blah` field as the identifier
      default: return defaultDataIdFromObject(object); // fall back to default handling
    }
  }
});
```

## Automatic cache updates

Let's look at a case where just using the cache normalization results in the correct update to our store. Let's say we perform the following query:

```graphql
{
  post(id: '5') {
    id
    score
  }
}
```

Then, we perform the following mutation:

```graphql
mutation {
  upvotePost(id: '5') {
    id
    score
  }
}
```

If the `id` field on both results matches up, then the `score` field everywhere in our UI will be updated automatically! One nice way to take advantage of this property as much as possible is to make your mutation results have all of the data necessary to update the queries previously fetched. A simple trick for this is to use [fragments](/data/fragments/) to share fields between the query and the mutation that affects it.
