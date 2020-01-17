---
title: Customizing the behavior of cached fields
---

You can customize how individual fields in the Apollo Client cache are read and written. To do so, you define a `FieldPolicy` object for a given field. You nest a `FieldPolicy` object within whatever [`TypePolicy` object](./cache-configuration/#the-typepolicy-type)  corresponds to the type that contains the field.

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
