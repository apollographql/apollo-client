---
title: InMemoryCache
description: InMemoryCache API reference
---

## `readQuery`

Run GraphQL queries directly against the cache.

For usage instructions, refer to [Interacting with cached data: `readQuery`](../../caching/cache-interaction/#readquery).

### Method

```ts:title=src/cache/core/cache.ts
readQuery<QueryType, TVariables = any>(
  options: DataProxy.Query<TVariables>,
  optimistic: boolean = false,
): QueryType | null
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `query` | `DocumentNode` | The GraphQL query shape to be used constructed using the `gql` template string tag from `graphql-tag`. The query will be used to determine the shape of the data to be read. |
| `variables?` | `TVariables` | Any variables that the GraphQL query may depend on. |
| `id?` | `string` | The root `id` to be used. Defaults to `ROOT_QUERY`, which is the ID of the root query object. |

#### `optimistic`

| Type | Description |
| - | - |
| `boolean` | Set to `true` to allow `readQuery` to return optimistic results. Is `false` by default. |

### Output

Query result data object (optionally typed by `QueryType`) or `null` if no matching data can be found.

## `writeQuery`

Write data in the shape of the provided GraphQL query, into the cache.

For usage instructions, refer to [Interacting with cached data: `writeQuery`](../../caching/cache-interaction/#writequery-and-writefragment).

### Method

```ts:title=src/cache/core/cache.ts
writeQuery<TData = any, TVariables = any>(
  options: Cache.WriteQueryOptions<TData, TVariables>,
): Reference | undefined
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `query` | `DocumentNode` | The GraphQL query shape to be used constructed using the `gql` template string tag from `graphql-tag`. The query will be used to determine the shape of the data to be written. |
| `variables?` | `TVariables` | Any variables that the GraphQL query may depend on. |
| `id?` | `string` | The root `id` to be used. Defaults to `ROOT_QUERY`, which is the ID of the root query object. This property makes `writeQuery` capable of writing data to any object in the cache, which renders `writeFragment` mostly useless. |
| `data` | `TData` | The data you will be writing to the cache. |
| `broadcast?` | `boolean` | Whether to notify query watchers (default: true). |

### Output

Returns a `Reference` to the written object, or `undefined` if the write failed.

## `readFragment`

Read data from the cache in the shape of the provided GraphQL fragment.

For usage instructions, refer to [Interacting with cached data: `readFragment`](../../caching/cache-interaction/#readfragment).

### Method

```ts:title=src/cache/core/cache.ts
readFragment<FragmentType, TVariables = any>(
  options: DataProxy.Fragment<TVariables>,
  optimistic: boolean = false,
): FragmentType | null
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `id?` | `string` | The root `id` to be used. If a value with your id does not exist in the cache, `null` will be returned. |
| `fragment` | `DocumentNode` | A GraphQL document created using the `gql` template string tag from `graphql-tag` with one or more fragments which will be used to determine the shape of data to read. If you provide more than one fragment in this document then you must also specify `fragmentName` to select a single fragment. |
| `fragmentName?` | `string` |  The name of the fragment in your GraphQL document to be used. If you do not provide a `fragmentName` and there is only one fragment in your `fragment` document, then that fragment will be used. |
| `variables?` | `TVariables` | Any variables that your GraphQL fragments depend on. |

#### `optimistic`

| Type | Description |
| - | - |
| `boolean` | Set to `true` to allow `readFragment` to return optimistic results. Is `false` by default. |

### Output

Fragment result data object (optionally typed by `FragmentType`) or `null` if no matching data can be found.

## `writeFragment`

Write data in the shape of the provided GraphQL fragment, into the cache.

For usage instructions, refer to [Interacting with cached data: `writeFragment`](../../caching/cache-interaction/#writequery-and-writefragment).

### Method

```ts:title=src/cache/core/cache.ts
writeFragment<TData = any, TVariables = any>(
  options: Cache.WriteFragmentOptions<TData, TVariables>,
): Reference | undefined
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `id?` | `string` | The root `id` to be used. |
| `fragment` | `DocumentNode` | A GraphQL document created using the `gql` template string tag from `graphql-tag` with one or more fragments which will be used to determine the shape of data to write. If you provide more than one fragment in this document then you must also specify `fragmentName` to select a single fragment. |
| `fragmentName?` | `string` |  The name of the fragment in your GraphQL document to be used. If you do not provide a `fragmentName` and there is only one fragment in your `fragment` document, then that fragment will be used. |
| `variables?` | `TVariables` | Any variables that your GraphQL fragments depend on. |
| `data` | `TData` | The data you will be writing to the cache. |
| `broadcast?` | `boolean` | Whether to notify query watchers (default: true). |

### Output

Returns a `Reference` to the written object, or `undefined` if the write failed.

## `identify`

Returns the canonical ID for a given cache object or reference.

For usage instructions, refer to [Interacting with cached data: Identify cached entities](../../caching/cache-interaction/#obtaining-an-objects-custom-id).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
identify(object: StoreObject | Reference): string | undefined
```

### Input

#### `object`

| Type | Description |
| - | - |
| `StoreObject` \| `Reference` | Either a cache object (an object with a `__typename` and any primary key fields required to identify entities of that type) or a `Reference` (an object with a `__ref` property). |

### Output

If `object` is a `StoreObject`, `identify` will return its string based ID (e.g. `Car:1`). If `object` a `Reference` object, `identify` will return its `__ref` ID string.

## `modify`

Takes an entity ID and an object mapping field names to modifier functions. For the specified entity, each field modifier function is called with the current value or references of the field, and should return a new value for the field to be written into the cache.

For usage instructions, see [`cache.modify`](../../caching/cache-interaction/#cachemodify).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
modify(options: Cache.ModifyOptions): boolean
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `id?` | `string` | ID of the cache object to be modified. |
| `fields` | `Modifiers` \| `Modifier<any>` | Map of field names to one or more `Modifier` functions, that are to be run for each field, returning a new value for the field that is then written into the cache. The `Modifier` function API is explained below. |
| `optimistic?` | `boolean` | Set to `true` to modify optimistic data. Is `false` by default. |
| `broadcast?` | `boolean` | Whether to notify query watchers (default: true). |

##### `Modifier` functions

E.g. A `Modifier` function for an `author` field:

```ts
// ...
fields: {
  author(author: Reference, { readField }) {
    // ...
    return author;
  }
}
// ...
```

The first parameter of a modifier function is the current value of the field being modified (`author` in the example above). The second parameter is a helper object that contains several utilities:

| Property | Type | Description |
| - | - | - |
| `fieldName` | `string` | The name of the field being modified. |
| `storeFieldName` | `string` | The full field key used internally, including serialized key arguments. |
| `readField` | `ReadFieldFunction` | A helper function for reading other fields within the current object. |
| `canRead` | `CanReadFunction` | Returns `true` for non-normalized `StoreObjects` and non-dangling `Reference`s, indicating that `readField(name, objOrRef)` has a chance of working. Useful for filtering out dangling references from lists. |
| `isReference` | `boolean` | Utility to check if an object is a `{ __ref }` object. |
| `DELETE` | `any` | Sentinel object that can be returned from a modifier function to delete the field being modified. |
| `INVALIDATE` | `any` | Sentinel object that can be returned from a modifier function to invalidate the field, causing affected queries to rerun, without changing or deleting the field value. |

`Modifier` functions should return the value that is to be written into the cache for the field being modified, or a `DELETE` sentinel to remove the field.

### Output

`cache.modify` returns `true` if the cache was modified successfully, `false` otherwise.

## `gc`

Request the garbage collection of unreachable normalized entities.

For usage instructions, see [`cache.gc`](../../caching/garbage-collection/#cachegc).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
gc()
```

### Input

None

### Output

Returns an array of ID strings that were removed from the cache, if any.

## `evict`

Remove whole objects from the cache by passing `options.id`, or specific fields by passing `options.field` and/or `options.args`. If no `options.args` are provided, all fields matching `options.field` (even those with arguments) will be removed.

For usage instructions, see [`cache.evict](../../caching/garbage-collection/#cacheevict).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
evict(options: Cache.EvictOptions): boolean
```

### Input

#### `options`

| Option | Type | Description |
| - | - | - |
| `id?` | `string` | ID of object to remove from the cache. |
| `fieldName?` | `string` | Specific field of an object to remove from the cache. |
| `args?` | `Record<string, any>` | Ensure only fields with these arguments are removed from the cache. |
| `broadcast?` | `boolean` | Whether to notify query watchers (default: true). |

### Output

Returns `true` if any data was removed from the cache, `false` otherwise.

## `extract`

Get a serialized representation of the cache's current state.

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
extract(optimistic: boolean = false): NormalizedCacheObject
```

### Input

| Param | Type | Description |
| - | - | - |
| `optimistic` | `boolean` | Set to `true` to include optimistic data in the extract. Is `false` by default. |

### Output

Returns a serialized representation of all cache contents (`NormalizedCacheObject`).

## `restore`

Replaces existing state in the cache (if any).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
restore(data: NormalizedCacheObject): this
```

### Input

| Param | Type | Description |
| - | - | - |
| `data` | `NormalizedCacheObject` | New cache state that will overwrite the existing cache state. |

### Output

Returns the current `InMemoryCache` instance.

## `makeVar`

Create/update/read reactive variables.

For usage instructions, refer to [Local state: Reactive variables](../../local-state/reactive-variables/).

### Method

```ts:title=src/cache/inmemory/inMemoryCache.ts
makeVar<T>(value: T): ReactiveVar<T>
```

### Input

| Param | Type | Description |
| - | - | - |
| `value` | `T` | New or updated value of the reactive variable. |

### Output

Returns a reactive variable function. Calling the function will return the value of the current reactive variable.
