---
title: Configuring the cache
---

Apollo Client stores the results of its GraphQL queries in a normalized, in-memory cache. This enables your client to respond to future queries for the same data without sending unnecessary network requests.

>This article describes cache setup and configuration. To learn how to interact with cached data, see [Interacting with cached data](./cache-interaction).

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
3. Whenever an incoming object is stored with the same ID as an _existing_ object, the fields of those objects are _merged_. If the incoming object and the existing object share any fields, the incoming object _overwrites_ the cached values for those fields. Fields that appear _only_ in the existing object _or_ the incoming object are preserved.

Normalization constructs a partial copy of your data graph on your client, in a format that's optimized for reading and updating the graph as your application changes state.

### Generating unique identifiers

>In Apollo Client 3 and later, the `InMemoryCache` never creates a fallback, "fake" identifier for an object when identifier generation fails or is disabled.

#### Default identifier generation

By default, the `InMemoryCache` generates a unique identifier for any object that includes a `__typename` field. To do so, it combines the object's `__typename` with its `id` or `_id` field (whichever is defined). These two values are separated by a colon (`:`).

For example, an object with a `__typename` of `Task` and an `id` of `14` is assigned a default identifier of `Task:14`.

#### Customizing identifier generation by type

If one of your types defines its primary key with a field _besides_ `id` or `_id`, you can customize how the `InMemoryCache` generates unique identifiers for that type. To do so, you define `TypePolicy` for the type. You specify all of your cache's `typePolicies` in [the `options` object you provide to the `InMemoryCache` constructor](#configuring-the-cache).

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

## Configuring individual fields

You can define a `FieldPolicy` object to customize cache interactions that involve a particular field. You nest `FieldPolicy` definitions within a corresponding `TypePolicy` definition.

The following example defines a `FieldPolicy` for the `name` field of a `Person` type. The `FieldPolicy` includes a [`read` function](#the-read-function), which modifies what the cache returns whenever the field is queried:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      fields: {
        name: {
          read(name) {
            return name.toUpperCase();
          }
        }
      },
    },
  },
});
```

The use cases for `FieldPolicy` objects are described below.

## Reducing cache duplicates by specifying key arguments

If a field accepts arguments, you can specify an array of `keyArgs` in the field's `FieldPolicy`. This array indicates which arguments are **key arguments** that are used to calculate the field's value. Specifying this array can help reduce the amount of duplicate data in your cache.

Let's say your schema's `Query` type includes a `monthForNumber` field that returns the details of a `Month` type, given a provided `number` argument (January for `1` and so on). The `number` argument is a key argument for this field, because it is used when calculating the field's result:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        monthForNumber: {
          keyArgs: ["number"],
        },
      },
    },
  },
});
```

An example of a _non-key_ argument is an access token, which is used to authorize a query but _not_ to calculate its result. If `monthForNumber` accepts an `accessToken` argument, the value of that argument does _not_ affect the details of the returned `Month` type.

By default, the cache stores a separate value for _every unique combination of argument values you provide when querying a particular field_. When you specify a field's key arguments, the cache understands that any _non_-key arguments don't affect that field's value. Consequently, if you execute two different queries with the `monthForNumber` field, passing the _same_ `number` argument but _different_ `accessToken` arguments, the second query response will overwrite the first, because both invocations have the same key arguments.

## Customizing field reads and writes

You can customize the cache's behavior when you read or write a particular field. For example, you might want the cache to return a particular default value for a field when that field isn't present in the cache.

To accomplish this, you can define `read` and `merge` functions as part of any field's `FieldPolicy`. These functions are called whenever the associated field is queried (`read`) or updated (`merge`) in the cache.

### The `read` function

If you define a `read` function for a field, the cache calls that function whenever your client queries for the field. In the query response, the field is populated with the `read` function's return value, _instead of the field's cached value_.

The `read` function takes the field's cached value as a parameter, so you can use it to help determine the function's return value.

The following `read` function assigns a default value of `UNKNOWN NAME` to the `name` field of a `Person` type, if the actual value is not available in the cache. In all other cases, the cached value is returned.

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      fields: {
        name: {
          read(name = "UNKNOWN NAME") {
            return name;
          }
        },
      },
    },
  },
});
```

If a field accepts arguments, its associated `read` function is passed the values of those arguments. The following `read` function checks to see if the `maxLength` argument is provided when the `name` field is queried. If it is, the function returns only the first `maxLength` characters of the person's name. Otherwise, the person's full name is returned.

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      fields: {

        // If a field's TypePolicy would only include a read function,
        // you can optionally define the function like so, instead of 
        // nesting it inside an object as shown in the example above.
        name(name: string, { args }) {
          if (args && typeof args.maxLength === "number") {
            return name.substring(0, args.maxLength);
          }
          return name;
        },
      },
    },
  },
});
```

You can define a `read` function for a field that isn't even defined in your schema. For example, the following `read` function enables you to query a `userId` field that is always populated with locally stored data:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Person: {
      fields: {
        userId() {
          return localStorage.loggedInUserId;
        },
      },
    },
  },
});
```

> Note that to query for a field that is only defined locally, your query should [include the `@client` directive](/data/local-state/#querying-local-state) on that field so that Apollo Client doesn't include it in requests to your GraphQL server.

Other use cases for a `read` function include:

* Transforming cached data to suit your client's needs, such as rounding floating-point values to the nearest integer
* Deriving local-only fields from one or more schema fields on the same object (such as deriving an `age` field from a `birthDate` field)
* Deriving local-only fields from one or more schema fields across _multiple_ objects

For a full list of the options provided to the `read` function, see the [API reference](#fieldpolicy-api-reference). You will almost never need to use all of these options, but each one has an important role when reading fields from the cache.

### The `merge` function

If you define a `merge` function for a field, the cache calls that function whenever the field is about to be written with an incoming value (such as from your GraphQL server). When the write occurs, the field's new value is set to the `merge` function's return value, _instead of the original incoming value_.

#### Merging arrays

A common use case for a `merge` function is to define how to write to a field that holds an array. By default, the field's existing array is _completely replaced_ by the incoming array. Often, it's preferable to _concatenate_ the two arrays instead, like so:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Agenda: {
      fields: {
        tasks: {
          merge(existing = [], incoming: any[]) {
            return [...existing, ...incoming];
          },
        },
      },
    },
  },
});
```

Note that `existing` is undefined the very first time this function is called for a given instance of the field, because the cache does not yet contain any data for the field. Providing the `existing = []` default parameter is a convenient way to handle this case.

> Your `merge` function **cannot** push the `incoming` array directly onto the `existing` array. It must instead return a new array to prevent potential errors. In development mode, Apollo Client prevents unintended modification of the `existing` data with `Object.freeze`.

#### Merging non-normalized objects

Another common use case for `merge` functions is to combine nested objects that do not have IDs but definitely represent the same underlying object. Suppose that a `Book` type has an `author` field, which is an object containing information like the author's `name`, `primaryLanguage`, and `yearOfBirth`.

TODO

### Handling pagination

When a field holds an array, it's often useful to [paginate](/data/pagination/) that array's results, because the total result set can be arbitrarily large.

Typically, a query includes pagination arguments that specify:

* Where to start in the array, using either a numeric offset or a starting ID
* The maximum number of elements to return in a single "page" 

If you implement pagination for a field, it's important to keep pagination arguments in mind if you then implement `read` and `merge` functions for the field:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Agenda: {
      fields: {
        tasks: {
          merge(existing: any[], incoming: any[], { args }) {
            const merged = existing ? existing.slice(0) : [];
            // Insert the incoming elements in the right places, according to args.
            for (let i = args.offset; i < args.offset + args.limit; ++i) {
              merged[i] = incoming[i - args.offset];
            }
            return merged;
          },

          read(existing: any[], { args }) {
            // If we read the field before any data has been written to the
            // cache, this function will return undefined, which correctly
            // indicates that the field is missing.
            return existing && existing.slice(
              args.offset,
              args.offset + args.limit,
            );
          },
        },
      },
    },
  },
});
```

As this example shows, your `read` function often needs to cooperate with your `merge` function, by handling the same arguments in the inverse direction.

If you want a given "page" to start after a specific entity ID instead of starting from `args.offset`, you can implement your `merge` and `read` functions as follows, using the `readField` helper function to examine existing task IDs:

```ts
const cache = new InMemoryCache({
  typePolicies: {
    Agenda: {
      fields: {
        tasks: {
          merge(existing: any[], incoming: any[], { args, readField }) {
            const merged = existing ? existing.slice(0) : [];
            // Obtain a Set of all existing task IDs.
            const existingIdSet = new Set(
              merged.map(task => readField("id", task)));
            // Remove incoming tasks already present in the existing data.
            incoming = incoming.filter(
              task => !existingIdSet.has(readField("id", task)));
            // Find the index of the task just before the incoming page of tasks.
            const afterIndex = merged.findIndex(
              task => args.afterId === readField("id", task));
            if (afterIndex >= 0) {
              // If we found afterIndex, insert incoming after that index.
              merged.splice(afterIndex + 1, 0, ...incoming);
            } else {
              // Otherwise insert incoming at the end of the existing data.
              merged.push(...incoming);
            }
            return merged;
          },

          read(existing: any[], { args, readField }) {
            if (existing) {
              const afterIndex = existing.findIndex(
                task => args.afterId === readField("id", task));
              if (afterIndex >= 0) {
                return existing.slice(
                  afterIndex + 1,
                  afterIndex + 1 + args.limit,
                );
              }
            }
          },
        },
      },
    },
  },
});
```

Note that if you call `readField(fieldName)`, it returns the value of the specified field from the current object. If you pass an object as a _second_ argument to `readField`, (e.g., `readField("id", task)`), `readField` instead reads the specified field from the specified object. In the above example, reading the `id` field from existing `Task` objects allows us to deduplicate the `incoming` task data.

The pagination code above is complicated, but after you define it for your preferred pagination strategy, you can reuse it for every field that uses that strategy, regardless of the field's type. For example:

```ts
function afterIdLimitPaginatedFieldPolicy<T>() {
  return {
    merge(existing: T[], incoming: T[], { args, readField }): T[] {
      ...
    },
    read(existing: T[], { args, readField }): T[] {
      ...
    },
  };
}

const cache = new InMemoryCache({
  typePolicies: {
    Agenda: {
      fields: {
        tasks: afterIdLimitPaginatedFieldPolicy<Reference>(),
      },
    },
  },
});
```

## `FieldPolicy` API reference

Here are the definitions for the `FieldPolicy` type and its related types:

```ts
export type FieldPolicy<TValue> = {
  keyArgs?: KeySpecifier | KeyArgsFunction | false;
  read?: FieldReadFunction<TValue>;
  merge?: FieldMergeFunction<TValue>;
};

type KeyArgsFunction = (
  field: FieldNode,
  context: {
    typename: string;
    variables: Record<string, any>;
    policies: Policies;
  },
) => string | null | void;

// These options are common to both read and merge functions:
interface FieldFunctionOptions {
  // The final argument values passed to the field, after applying variables.
  // If no arguments were provided, this property will be null.
  args: Record<string, any> | null;

  // The name of the field, equal to options.field.name.value when
  // options.field is available. Useful if you reuse the same function for
  // multiple fields, and you need to know which field you're currently
  // processing. Always a string, even when options.field is null.
  fieldName: string;

  // The FieldNode object used to read this field. Useful if you need to
  // know about other attributes of the field, such as its directives. This
  // option will be null when a string was passed to options.readField.
  field: FieldNode | null;

  // The variables that were provided when reading the query that contained
  // this field. Possibly undefined, if no variables were provided.
  variables?: Record<string, any>;

  // Utilities for handling { __ref: string } references.
  isReference(obj: any): obj is Reference;
  toReference(obj: StoreObject): Reference;

  // A reference to the Policies object created by passing typePolicies to
  // the InMemoryCache constructor, for advanced/internal use.
  policies: Policies;
}

// These options are specific to read functions:
interface ReadFunctionOptions extends FieldFunctionOptions {
  // Helper function for reading other fields within the current object.
  // If a foreign object or reference is provided, the field will be read
  // from that object instead of the current object, so this function can
  // be used (together with isReference) to examine the cache outside the
  // current object. If a FieldNode is passed instead of a string, and
  // that FieldNode has arguments, the same options.variables will be used
  // to compute the argument values. Note that this function will invoke
  // custom read functions for other fields, if defined. Always returns
  // immutable data (enforced with Object.freeze in development).
  readField<T = StoreValue>(
    nameOrField: string | FieldNode,
    foreignObjOrRef?: StoreObject | Reference,
  ): Readonly<T>;

  // A handy place to put field-specific data that you want to survive
  // across multiple read function calls. Useful for caching.
  storage: Record<string, any>;

  // Call this function to invalidate any cached queries that previously
  // consumed this field. If you use options.storage as a cache, setting a
  // new value in the cache and then calling options.invalidate() can be a
  // good way to deliver asynchronous results.
  invalidate(): void;
}
```

type FieldReadFunction<TExisting, TResult = TExisting> = (
  existing: Readonly<TExisting> | undefined,
  options: ReadFunctionOptions,
) => TResult;

type FieldMergeFunction<TExisting> = (
  existing: Readonly<TExisting> | undefined,
  incoming: Readonly<StoreValue>,
  options: FieldFunctionOptions,
) => TExisting;
```
