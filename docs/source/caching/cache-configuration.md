---
title: Configuring the cache
---

Apollo Client uses an in-memory cache to ingest the results of past GraphQL queries into a normalized graph format that allows the client to respond efficiently to future queries for the same data, without sending unnecessary network requests.

While the default caching behavior should be adequate for most basic use cases, additional configuration may be necessary to implement more advanced use cases, including but not limited to
* custom primary key fields
* supertype-subtype relationships for fragment matching
* custom storage and retrieval of field values
* specialized interpretation of field arguments
* pagination-related patterns
* client-side local state management

This article covers cache setup and configuration.

## Installation

As of Apollo Client 3.0, the `InMemoryCache` class is provided by the `@apollo/client` package, so you no longer need to install a separate package after running
```bash
npm install @apollo/client
```

## Initializing the cache

Create an `InMemoryCache` object and provide it to the `ApolloClient` constructor like so:
```ts
import { InMemoryCache, HttpLink, ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink(),
  cache: new InMemoryCache(options)
});
```

The `InMemoryCache` constructor accepts a variety of named options, described below.

## Basic usage

To learn how to use the `InMemoryCache` to read or write data, consult the [Cache interaction](/caching/cache-interaction.md) documentation.

## Configuring the cache

You can provide an options object to the `InMemoryCache` constructor to configure its behavior. This object supports the following fields:

| Name | Type | Description |
| ------- | ----- | --------- |
| `addTypename`  | boolean | Causes the cache to add `__typename` fields to outgoing queries automatically, so the developer does not have to worry about explicitly requesting this vital information. (default: `true`) |
| `resultCaching` | boolean | When this option is enabled, the cache will return identical (`===`) response objects whenever the underlying data have not changed, simplifying change detection. (default: `true`) |
| `possibleTypes` | `{ [supertype: string]: string[] }` | To support polymorphic fragment type matching, the cache needs to know about any subtype relationships defined in your schema, such as a union type and its member types, or an interface and any interfaces that extend it. This option replaces the `fragmentMatcher` option from the `apollo-cache-inmemory` package. |
| `typePolicies` | `{ [typename: string]: TypePolicy }` | Map from `__typename` to type-specific configuration options (see `TypePolicy` documentation [below](#TODO)). |
| `dataIdFromObject` | function | A function that takes a response object and returns a unique identifier to be used when normalizing the data in the store. Deprecated in favor of the `keyFields` option of `TypePolicy` objects. |

## Data normalization

The `InMemoryCache` normalizes query response objects before saving them to its internal data store, which involves

1. computing a unique ID for any identifiable entity objects found in the response
2. storing those entity objects by ID in a flat lookup table
3. merging fields together whenever multiple entity objects are written with the same ID

This process effectively reconstructs a partial copy of your data graph on the client, in the most convenient format for reading and updating the graph as the application changes state.

The only scenario in which your application might not benefit from normalization is if you execute a single query during page load and then never make any further queries or mutations. Even then, your single-serving application could probably benefit from persisting the cache to `localStorage`, IndexedDB, or some similar device storage API, in which case normalization would allow efficiently computing the differences between cached data and fresh data, so your UI can rerender only what has changed. In short, GraphQL-aware normalization is your friend and ally in almost any conceivable Apollo Client setup.

### Assigning unique identifiers

#### Default identifiers

By default, the `InMemoryCache` attempts to generate a unique identifier for any object that has a `__typename` by combining the `__typename` string with the object's `id` or `_id` field.

In other words, if you receive a response that contains objects like `{ __typename: 'Task', id: 14, text: 'finish docs' }`, the default ID will look like `Task:14`.

#### Custom identifiers

If your entity objects use a primary key field (or _fields_) different from `id` or `_id`, you can configure the cache using a `TypePolicy` object with a `keyFields` option:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Product: {
      // In most inventory management systems, a single UPC code uniquely identifies
      // any product.
      keyFields: ["upc"],
    },
    Person: {
      // In some user account systems, names or emails alone do not have to be unique,
      // but the combination of a person's name and email is uniquely identifying.
      keyFields: ["name", "email"],
    },
    Book: {
      // If one of the keyFields is an object with fields of its own, you can include
      // those nested keyFields by using a nested array of strings:
      keyFields: ["title", "author", ["name"]],
    },
  },
});
```

In the `Book` example above, the ID computed for any object with `object.__typename === 'Book'` would look something like `'Book:{"title":"Fahrenheit 451","author":{"name":"Ray Bradbury"}}'`, with `title` and `author` always in that order. This ordering is important because other common tools like `JSON.stringify` serialize object properties in the order they were created, which can differ from response object to response object, causing subtle normalization bugs.

Note that these `keyFields` strings always refer to the actual field names as defined in your schema, so the ID computation is not sensitive to [field aliases](https://www.apollographql.com/docs/resources/graphql-glossary/#alias). This note is important if you ever decide to use a function to implement `keyFields`:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      keyFields(responseObject, { typename, selectionSet, fragmentMap }) {
        let id: string | null = null;
        selectionSet.selections.some(selection => {
          if (selection.kind === 'Field') {
            // If you fail to take aliasing into account, your custom normalization
            // is likely to break whenever a query contains an alias for key field.
            const actualFieldName = selection.name.value;
            const responseFieldName = (selection.alias || selection.name).value;
            if (actualFieldName === 'socialSecurityNumber') {
              id = `${typename}:${responseObject[responseFieldName]}`;
              return true;
            }
          }
          return false;
        });
        return id;
      },
    },
  },
});
```

If this edge case seems obscure, then you should probably steer clear of implementing your own `keyFields` functions, and instead stick to passing an array of strings for `keyFields`, so that you never have to worry about subtle bugs like these. As a general rule, the `typePolicies` API allows you to configure normalization behavior in one place, when you first create your cache, and does not require you to write your queries differently by aliasing fields (or not) or using directives.

#### Disabling normalization for specific `__typename`s

As you might have noticed above, it's possible to return `null` from the `keyFields` function to disable normalization for a given `__typename`. Alternatively, you can simply provide `keyFields: false` to disable normalization.

Objects that are not normalized will be embedded as ordinary objects within their parent objects in the cache, instead of being hoisted by ID to the top level of the normalized cache.

Disabling normalization may make sense for transient data such as metrics that are identified by timestamp, and will never receive updates, though they may eventually be replaced by more recent data.

#### What about `dataIdFromObject`?

If you need to define a single fallback `keyFields` function that isn't specific to any particular `__typename`, the old `dataIdFromObject` function from Apollo Client 2.x is still supported:

```ts
import { defaultDataIdFromObject } from '@apollo/client';
const cache = new InMemoryCache({
  dataIdFromObject(responseObject) {
    switch (object.__typename) {
      case 'Product': return `Product:${object.upc}`;
      case 'Person': return `Person:${object.name}:${object.email}`;
      default: return defaultDataIdFromObject(object);
    }
  }
});
```

Notice how this function ends up needing to select different keys based on specific `object.__typename` strings, so you might as well have used `keyFields` arrays for the `Product` and `Person` types via `typePolicies`. Also, this code is sensitive to aliasing mistakes, it does nothing to protect against undefined `object` properties, and accidentally using different key fields at different times could cause inconsistencies in the cache.

The `dataIdFromObject` API is meant to ease the transition from Apollo Client 2.x to 3.0, and may be removed in future versions of `@apollo/client`.
