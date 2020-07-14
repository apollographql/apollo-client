---
title: Configuring the cache
sidebar_title: Configuration
---

Apollo Client stores the results of its GraphQL queries in a normalized, in-memory cache. This enables your client to respond to future queries for the same data without sending unnecessary network requests.

This article describes cache setup and configuration. To learn how to interact with cached data, see [Reading and writing data to the cache](./cache-interaction).

## Installation

As of Apollo Client 3.0, the `InMemoryCache` class is provided by the `@apollo/client` package. No additional libraries are required.

## Initialization

Create an `InMemoryCache` object and provide it to the `ApolloClient` constructor, like so:

```ts
import { InMemoryCache, ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  // ...other arguments...
  cache: new InMemoryCache(options)
});
```

The `InMemoryCache` constructor accepts a variety of [configuration options](#configuration-options).

## Configuration options

Although the cache's default behavior is suitable for a wide variety of applications, you can configure its behavior to better suit your particular use case. In particular, you can:

* Specify custom primary key fields
* Customize the storage and retrieval of individual fields
* Customize the interpretation of field arguments
* Define supertype-subtype relationships for fragment matching
* Define patterns for pagination
* Manage client-side local state

To customize cache behavior, provide an `options` object to the `InMemoryCache` constructor. This object supports the following fields:

| Name | Type | Description |
| ------- | ----- | --------- |
| `addTypename`  | boolean | <p>If `true`, the cache automatically adds `__typename` fields to all outgoing queries, removing the need to add them manually.</p><p>Default: `true`</p> |
| `resultCaching` | boolean | <p>If `true`, the cache returns an identical (`===`) response object for every execution of the same query, as long as the underlying data remains unchanged. This makes it easier to detect changes to a query's result.</p><p>Default: `true`</p> |
| `possibleTypes` | `{ [supertype: string]: string[] }` | <p>Include this object to define polymorphic relationships between your schema's types. Doing so enables you to look up cached data by interface or by union.</p><p>The key for each entry is the `__typename` of an interface or union, and the value is an array of the `__typename`s of the types that either belong to the corresponding union or implement the corresponding interface.</p> |
| `typePolicies` | `{ [typename: string]: TypePolicy }` | <p>Include this object to customize the cache's behavior on a type-by-type basis.</p><p>The key for each entry is a type's `__typename`. For details, see [`TypePolicy` fields](#typepolicy-fields).</p> |
| `dataIdFromObject` **(deprecated)** | function | <p>A function that takes a response object and returns a unique identifier to be used when normalizing the data in the store.</p><p>Deprecated in favor of the `keyFields` option of the `TypePolicy` object.</p> |

## Data normalization

The `InMemoryCache` **normalizes** query response objects before it saves them to its internal data store. Normalization involves the following steps:

1. The cache [generates a unique ID](#generating-unique-identifiers) for every identifiable object included in the response.
2. The cache stores the objects by ID in a flat lookup table.
3. Whenever an incoming object is stored with the same ID as an _existing_ object, the fields of those objects are _merged_.
    * If the incoming object and the existing object share any fields, the incoming object _overwrites_ the cached values for those fields.
    * Fields that appear in _only_ the existing object or _only_ the incoming object are preserved.

Normalization constructs a partial copy of your data graph on your client, in a format that's optimized for reading and updating the graph as your application changes state.

### Generating unique identifiers

>In Apollo Client 3 and later, the `InMemoryCache` never creates a fallback, "fake" identifier for an object when identifier generation fails or is disabled.

#### Default identifier generation

By default, the `InMemoryCache` generates a unique identifier for any object that includes a `__typename` field. To do so, it combines the object's `__typename` with its `id` or `_id` field (whichever is defined). These two values are separated by a colon (`:`).

For example, an object with a `__typename` of `Task` and an `id` of `14` is assigned a default identifier of `Task:14`.

#### Customizing identifier generation by type

If one of your types defines its primary key with a field _besides_ `id` or `_id`, you can customize how the `InMemoryCache` generates unique identifiers for that type. To do so, you define `TypePolicy` for the type. You specify all of your cache's `typePolicies` in [the `options` object you provide to the `InMemoryCache` constructor](#configuration-options).

Include a `keyFields` field in relevant `TypePolicy` objects, like so:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Product: {
      // In most inventory management systems, a single UPC code uniquely
      // identifies any product.
      keyFields: ["upc"],
    },
    Person: {
      // In some user account systems, names or emails alone do not have to
      // be unique, but the combination of a person's name and email is
      // uniquely identifying.
      keyFields: ["name", "email"],
    },
    Book: {
      // If one of the keyFields is an object with fields of its own, you can
      // include those nested keyFields by using a nested array of strings:
      keyFields: ["title", "author", ["name"]],
    },
  },
});
```

This example shows three `typePolicies`: one for a `Product` type, one for a `Person` type, and one for a `Book` type. Each `TypePolicy`'s `keyFields` array defines which fields on the type _together_ represent the type's primary key.

The `Book` type above uses a _subfield_ as part of its primary key. The `["name"]` item indicates that the `name` field of the _previous_ field in the array (`author`) is part of the primary key. The `Book`'s `author` field must be an object that includes a `name` field for this to be valid.

In the example above, the resulting identifier string for a `Book` object has the following structure:

```
Book:{"title":"Fahrenheit 451","author":{"name":"Ray Bradbury"}}
```

An object's primary key fields are always listed in the same order to ensure uniqueness.

Note that these `keyFields` strings always refer to the actual field names as defined in your schema, meaning the ID computation is not sensitive to [field aliases](https://www.apollographql.com/docs/resources/graphql-glossary/#alias).

#### Calculating an object's identifier

If you define a custom identifier that uses multiple fields, it can be challenging to calculate and provide that identifier to methods that require it (such as `cache.readFragment`).

To help with this, you can use the `cache.identify` method to calculate the identifier for any normalized object you fetch from your cache. See [Obtaining an object's custom ID](./cache-interaction/#obtaining-an-objects-custom-id).

#### Customizing identifier generation globally

If you need to define a single fallback `keyFields` function that isn't specific to any particular `__typename`, you can use the `dataIdFromObject` function that was introduced in Apollo Client 2.x:

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

> The `dataIdFromObject` API is included in Apollo Client 3.0 to ease the transition from Apollo Client 2.x. The API might be removed in a future version of `@apollo/client`.

Notice that the above function still uses different logic to generate keys based on an object's `__typename`. In the above case, you might as well define `keyFields` arrays for the `Product` and `Person` types via `typePolicies`. Also, this code is sensitive to aliasing mistakes, it does nothing to protect against undefined `object` properties, and accidentally using different key fields at different times can cause inconsistencies in the cache.

### Disabling normalization

You can instruct the `InMemoryCache` _not_ to normalize objects of a certain type. This can be useful for metrics and other transient data that's identified by a timestamp and never receives updates.

To disable normalization for a type, define a `TypePolicy` for the type (as shown in [Customizing identifier generation by type](#customizing-identifier-generation-by-type)) and set the policy's `keyFields` field to `false`.

Objects that are not normalized are instead embedded within their _parent_ object in the cache. You can't access these objects directly, but you can access them via their parent.

## `TypePolicy` fields

To customize how the cache interacts with specific types in your schema, you can provide an object mapping `__typename` strings to `TypePolicy` objects when you create a new `InMemoryCache` object.

A `TypePolicy` object can include the following fields:

```ts
type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names, a function that returns an arbitrary string, or
  // false to disable normalization for objects of this type.
  keyFields?: KeySpecifier | KeyFieldsFunction | false;

  // If your schema uses a custom __typename for any of the root Query,
  // Mutation, and/or Subscription types (rare), set the corresponding
  // field below to true to indicate that this type serves as that type.
  queryType?: true,
  mutationType?: true,
  subscriptionType?: true,

  fields?: {
    [fieldName: string]:
      | FieldPolicy<StoreValue>
      | FieldReadFunction<StoreValue>;
  }
};

// Recursive type aliases are coming in TypeScript 3.7, so this isn't the
// actual type we use, but it's what it should be:
type KeySpecifier = (string | KeySpecifier)[];

type KeyFieldsFunction = (
  object: Readonly<StoreObject>,
  context: {
    typename: string;
    selectionSet?: SelectionSetNode;
    fragmentMap?: FragmentMap;
  },
) => string | null | void;
```

### Overriding root operation types (uncommon)

In addition to `keyFields`, a `TypePolicy` can indicate that it represents the root query, mutation, or subscription type by setting `queryType`, `mutationType`, or `subscriptionType` as `true`:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    UnconventionalRootQuery: {
      // The RootQueryFragment can only match if the cache knows the __typename
      // of the root query object.
      queryType: true,
    },
  },
});

const result = cache.readQuery({
  query: gql`
    query MyQuery {
      ...RootQueryFragment
    }
    fragment RootQueryFragment on UnconventionalRootQuery {
      field1
      field2 {
        subfield
      }
    }
  `,
});

const equivalentResult = cache.readQuery({
  query: gql`
    query MyQuery {
      field1
      field2 {
        subfield
      }
    }
  `,
});
```

The cache normally obtains `__typename` information by adding the `__typename` field to every query selection set it sends to the server. It could technically use the same trick for the outermost selection set of every operation, but the `__typename` of the root query or mutation is almost always simply `"Query"` or `"Mutation"`, so the cache assumes those common defaults unless instructed otherwise in a `TypePolicy`.

Compared to the `__typename`s of entity objects like `Book`s or `Person`s, which are absolutely vital to proper identification and normalization, the `__typename` of the root query or mutation type is not nearly as useful or important, because those types are singletons with only one instance per client.

### The `fields` property

The final property within `TypePolicy` is the `fields` property, which is a map from string field names to `FieldPolicy` objects. For more information on this field, see [Customizing the behavior of cached fields](./cache-field-behavior).
