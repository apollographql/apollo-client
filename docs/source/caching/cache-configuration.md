---
title: Configuring the cache
---

Apollo Client stores the results of its GraphQL queries in a normalized, in-memory cache. This enables your client to respond to future queries for the same data without sending unnecessary network requests.

>This article describes cache setup and configuration. To learn how to interact with cached data, see [Interacting with cached data](/caching/cache-interaction/).

## Installation

As of Apollo Client 3.0, the `InMemoryCache` class is provided by the `@apollo/client` package. You no longer need to install a separate package after running `npm install @apollo/client`.

## Initializing the cache

Create an `InMemoryCache` object and provide it to the `ApolloClient` constructor like so:

```ts
import { InMemoryCache, HttpLink, ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink(),
  cache: new InMemoryCache(options)
});
```

The `InMemoryCache` constructor accepts a variety of named `options`, described below.

## Configuring the cache

Although the cache's default behavior is suitable for a wide variety of applications, you can configure its behavior to better suit your particular use case. In particular, you can:

* Specify custom primary key fields
* Customize the storage and retrieval of field values
* Customize the interpretation of field arguments
* Define supertype-subtype relationships for fragment matching
* Define patterns for pagination
* Manage client-side local state

To customize cache behavior, provide an `options` object to the `InMemoryCache` constructor. This object supports the following fields:

| Name | Type | Description |
| ------- | ----- | --------- |
| `addTypename`  | boolean | If `true`, the cache automatically adds `__typename` fields to all outgoing queries, removing the need to add them manually. (default: `true`) |
| `resultCaching` | boolean | If `true`, the cache returns an identical (`===`) response object for every execution of the same query, as long as the underlying data remains unchanged. This makes it easier to detect changes to a query's result. (default: `true`) |
| `possibleTypes` | `{ [supertype: string]: string[] }` | Include this object to define polymorphic relationships between your schema's types. Doing so enables you to look up cached data by interface or by union. The key for each entry is the `__typename` of an interface or union, and the value is an array of the `__typename`s of the types that either belong to the corresponding union or implement the corresponding interface. |
| `typePolicies` | `{ [typename: string]: TypePolicy }` | Include this object to customize the cache's behavior on a type-by-type basis. The key for each entry is a type's `__typename`. For details, see [The `TypePolicy` type](#the-typepolicy-type). |
| `dataIdFromObject` **(deprecated)** | function | A function that takes a response object and returns a unique identifier to be used when normalizing the data in the store. Deprecated in favor of the `keyFields` option of the `TypePolicy` object. |

## Data normalization

The `InMemoryCache` **normalizes** query response objects before it saves them to its internal data store. Normalization involves the following steps:

1. The cache [generates a unique ID](#generating-unique-identifiers) for every identifiable object included in the response.
2. The cache stores the objects by ID in a flat lookup table.
3. Whenever an object is stored with the same ID as an _existing_ object, the fields of those objects are _merged_. The new object overwrites the values of any fields that appear in both.

Normalization constructs a partial copy of your data graph on your client, in a format that's optimized for reading and updating the graph as your application changes state.

### Generating unique identifiers

>In Apollo Client 3 and later, the `InMemoryCache` never creates a fallback, "fake" identifier for an object when identifier generation fails or is disabled.

#### Default identifier generation

By default, the `InMemoryCache` generates a unique identifier for any object that includes a `__typename` field by combining the object's `__typename` with its `id` or `_id` field (whichever is defined). These two values are separated by a colon (`:`).

For example, an object with a `__typename` of `Task` and an `id` of `14` is assigned a default identifier of `Task:14`.

#### Customizing identifier generation by type

If one of your types defines its primary key with a field besides `id` or `_id`, you can customize how the `InMemoryCache` generates its unique identifier by defining a `TypePolicy` for the type. You specify all of your cache's `typePolicies` in [the `options` object you provide to the `InMemoryCache` constructor](#configuring-the-cache).

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

Note that the `Book` type uses a _subfield_ as part of its primary key. The `["name"]` item indicates that the `name` field of the _previous_ field in the array (`author`) is part of the primary key. The `Book`'s `author` field must be an object that includes a `name` field for this to be valid.

In the example above, the unique identifier string for a `Book` object has the following format:

```
Book:{"title":"Fahrenheit 451","author":{"name":"Ray Bradbury"}}
```

The object's primary key fields are always listed in the same order to ensure uniqueness.

Note that these `keyFields` strings always refer to the actual field names as defined in your schema, meaning the ID computation is not sensitive to [field aliases](https://www.apollographql.com/docs/resources/graphql-glossary/#alias). This note is important if you ever attempt to use a function to implement `keyFields`:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      keyFields(responseObject, { typename, selectionSet, fragmentMap }) {
        let id: string | null = null;
        selectionSet.selections.some(selection => {
          if (selection.kind === 'Field') {
            // If you fail to take aliasing into account, your custom
            // normalization is likely to break whenever a query contains
            // an alias for key field.
            const actualFieldName = selection.name.value;
            const responseFieldName = (selection.alias || selection.name).value;
            if (actualFieldName === 'socialSecurityNumber') {
              id = `${typename}:${responseObject[responseFieldName]}`;
              return true;
            }
          } else {
            // Handle fragments using the fragmentMap...
          }
          return false;
        });
        return id;
      },
    },
  },
});
```

If this edge case seems obscure, you should probably steer clear of implementing your own `keyFields` functions, and instead stick to passing an array of strings for `keyFields`, so that you never have to worry about subtle bugs like these. As a general rule, the `typePolicies` API allows you to configure normalization behavior in one place, when you first create your cache, and does not require you to write your queries differently by aliasing fields or using directives.

#### Customizing identifier generation globally

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

Notice how this function ends up needing to select different keys based on specific `object.__typename` strings anyway, so you might as well have used `keyFields` arrays for the `Product` and `Person` types via `typePolicies`. Also, this code is sensitive to aliasing mistakes, it does nothing to protect against undefined `object` properties, and accidentally using different key fields at different times could cause inconsistencies in the cache.

The `dataIdFromObject` API is meant to ease the transition from Apollo Client 2.x to 3.0, and may be removed in future versions of `@apollo/client`.

### Disabling normalization

You can instruct the `InMemoryCache` _not_ to normalize objects of a certain type. This might make sense for metrics and other transient data that are identified by a timestamp and never receive updates.

To disable normalization for a type, define a `TypePolicy` for the type (as shown in [Customizing identifier generation by type](#customizing-identifier-generation-by-type)), but set the policy's `keyFields` field to `false`.

Objects that are not normalized are instead embedded within their _parent_ object in the cache. You cannot access these objects directly and must instead access them via their parent.

## The `TypePolicy` type

To customize how the cache interacts with specific types in your schema, you can provide an object mapping `__typename` strings to `TypePolicy` objects when you create a new `InMemoryCache` object.

A `TypePolicy` object can include the following fields:

```ts
type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names or a function that returns an arbitrary string.
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
    query {
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
    query {
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

The final property within `TypePolicy` is the `fields` property, which is a map from string field names to `FieldPolicy` objects. The next section covers field policies in depth.

## Field policies

In addition to configuring the identification and normalization of `__typename`-having entity objects, a `TypePolicy` can provide policies for any of the fields supported by that type.

Here are the `FieldPolicy` type and its related types:

```ts
export type FieldPolicy<TValue> = {
  keyArgs?: KeySpecifier | KeyArgsFunction;
  read?: FieldReadFunction<TValue>;
  merge?: FieldMergeFunction<TValue>;
};

type KeyArgsFunction = (
  field: FieldNode,
  context: {
    typename: string;
    variables: Record<string, any>;
  },
) => string | null | void;

type FieldReadFunction<TExisting, TResult = TExisting> = (
  existing: Readonly<TExisting> | undefined,
  options: FieldFunctionOptions,
) => TResult;

type FieldMergeFunction<TExisting> = (
  existing: Readonly<TExisting> | undefined,
  incoming: Readonly<StoreValue>,
  options: FieldFunctionOptions,
) => TExisting;

interface FieldFunctionOptions {
  args: Record<string, any>;
  parentObject: Readonly<StoreObject>;
  field: FieldNode;
  variables?: Record<string, any>;
}
```

In the sections below, we will break down these types with explanations and examples.

### Key arguments

Similar to the `keyFields` property of `TypePolicy` objects, the `keyArgs` property of `FieldPolicy` objects tells the cache which arguments passed to the field are "important" in the sense that their values (together with the enclosing entity object) determine the field's value.

By default, the cache assumes all field arguments might be important, so it stores a separate field value for each unique combination of argument values it has received for that field. This is a safe policy because it ensures field values do not collide with each other if there was any difference in their arguments. However, this policy can also lead to unnecessary copies of field values, as well as missed opportunities for fields to share the same logical value even if their arguments were slightly different.

For example, imagine you have a field that returns a secret value according to a given key, but also requires an access token to authenticate the request:

```ts
query GetSecret {
  secret(key: $secretKey, token: $secretAccessToken) {
    message
  }
}
```

As long as you have a valid access token, the value of this field depends only on the `key`. In other words, you won't get a different secret message back just because you used a different (valid) token.

In cases like this, it would be wasteful and potentially inconsistent to let the access token factor into the storage of the field value, so you should let the cache know that only `key` is "important" by using the `keyArgs` option of the `FieldPolicy` for the `secret` field:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        secret: {
          keyArgs: ["key"],
        },
      },
    },
  },
});
```

That said, you might be able to assume the `token` is always the same, or you might not be worried about duplicating field values in the cache, so neglecting to specify `keyArgs: ["key"]` probably will not cause any major problems. Use `keyArgs` when it helps.

On the other hand, perhaps you've requested the secret from the server using the access `token`, but you want various components on your page to be able to access the secret using only they `key`, without having to know the `token`. Storing the value in the cache using only the `key` makes this retrieval possible.

### Custom field `read` functions

TODO Example of { book, books }
TODO Example of textual search

### Custom field `merge` functions

### Pagination example
