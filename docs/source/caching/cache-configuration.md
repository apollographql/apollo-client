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

As of Apollo Client 3.0, the `InMemoryCache` class is provided by the `@apollo/client` package, so you no longer need to install a separate package after running `npm install @apollo/client`.

## Initializing the cache

Create an `InMemoryCache` object and provide it to the `ApolloClient` constructor like so:
```ts
import { InMemoryCache, HttpLink, ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink(),
  cache: new InMemoryCache(options)
});
```

To learn how to use the `InMemoryCache` to read or write data, consult the [Cache interaction](/caching/cache-interaction) documentation.

The `InMemoryCache` constructor accepts a variety of named options, described below.

## Configuring the cache

You can provide an options object to the `InMemoryCache` constructor to configure its behavior. This object supports the following fields:

| Name | Type | Description |
| ------- | ----- | --------- |
| `addTypename`  | boolean | Causes the cache to add `__typename` fields to outgoing queries automatically, so the developer does not have to worry about explicitly requesting this vital information. (default: `true`) |
| `resultCaching` | boolean | When this option is enabled, the cache will return identical (`===`) response objects whenever the underlying data have not changed, simplifying change detection. (default: `true`) |
| `possibleTypes` | `{ [supertype: string]: string[] }` | To support polymorphic fragment type matching, the cache needs to know about any subtype relationships defined in your schema, such as a union type and its member types, or an interface and any interfaces that extend it. This option replaces `fragmentMatcher` from the old `apollo-cache-inmemory` package. |
| `typePolicies` | `{ [typename: string]: TypePolicy }` | Map from `__typename` to type-specific configuration options (see `TypePolicy` documentation [below](#TODO)). |
| `dataIdFromObject` | function | A function that takes a response object and returns a unique identifier to be used when normalizing the data in the store. Deprecated in favor of the `keyFields` option of `TypePolicy` objects. |

## Data normalization

The `InMemoryCache` normalizes query response objects before saving them to its internal data store, which involves

1. computing a unique ID for any identifiable entity objects found in the response
2. storing those entity objects by ID in a flat lookup table
3. merging fields together whenever multiple entity objects are written with the same ID

This process effectively reconstructs a partial copy of your data graph on the client, in the most convenient format for reading and updating the graph as the application changes state.

The only scenario in which your application might not benefit from normalization is if you execute a single query during page load and then never make any further queries or mutations. Even then, your single-serving application could probably benefit from persisting the cache to `localStorage`, IndexedDB, or some similar device storage API, in which case normalization would allow efficiently computing the differences between cached data and fresh data, so your UI can rerender only what has changed. In short, GraphQL-aware normalization is your friend and ally in almost any conceivable Apollo Client setup.

### Computing unique identifiers

#### Default identifiers

By default, the `InMemoryCache` attempts to generate a unique identifier for any object that has a `__typename` by combining the `__typename` string with the object's `id` or `_id` field.

In other words, if you receive a response that contains objects like `{ __typename: 'Task', id: 14 }`, the default ID will be `Task:14`.

#### Custom identifiers

If your entity objects use primary key fields different from `id` or `_id`, you can configure the cache using a `TypePolicy` object with a `keyFields` option:

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

These arrays of strings are meant to resemble fields that can appear in the selection set of a GraphQL fragment. So, for example `["title", "author", ["name"]]` expresses the fragment `...{ title author { name }}`.

In the `Book` example above, the ID computed for any object with `object.__typename === 'Book'` would be `'Book:{"title":"Fahrenheit 451","author":{"name":"Ray Bradbury"}}'`, with `title` and `author` always in that order. This ordering is important because tools like `JSON.stringify` serialize object properties in the order they were created, which can differ from response object to response object, causing subtle normalization bugs.

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

#### Disabling normalization for specific `__typename`s

As you might have noticed above, it's possible to return `null` from the `keyFields` function to disable normalization for a given object. Alternatively, you can disable normalization for all objects with a certain `__typename` by assigning it a `TypePolicy` with `keyFields: false`.

Objects that are not normalized will be embedded as ordinary objects within their parent objects in the cache, instead of being hoisted by ID to the top level of the normalized cache. Unlike `apollo-cache-inmemory`, the Apollo Client 3.0 cache never generates fake identifiers for unidentified objects.

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

Notice how this function ends up needing to select different keys based on specific `object.__typename` strings anyway, so you might as well have used `keyFields` arrays for the `Product` and `Person` types via `typePolicies`. Also, this code is sensitive to aliasing mistakes, it does nothing to protect against undefined `object` properties, and accidentally using different key fields at different times could cause inconsistencies in the cache.

The `dataIdFromObject` API is meant to ease the transition from Apollo Client 2.x to 3.0, and may be removed in future versions of `@apollo/client`.

## A closer look at the `TypePolicy` type

Although we have already seen several examples of `TypePolicy` objects, those examples only used the `keyFields` option. Here is the rest of the `TypePolicy` type:

```ts
type TypePolicy = {
  // Allows defining the primary key fields for this type, either using an
  // array of field names or a function that returns an arbitrary string.
  keyFields?: KeySpecifier | KeyFieldsFunction | false;

  // In the rare event that your schema happens to use a different
  // __typename for the root Query, Mutation, and/or Schema types, you can
  // express your preferences by enabling one of these options.
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
