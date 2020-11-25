---
title: Garbage collection and cache eviction
sidebar_title: Garbage collection and eviction
---

Apollo Client 3 enables you to selectively remove cached data that is no longer useful. The default garbage collection strategy of the `gc` method is suitable for most applications, but the `evict` method provides more fine-grained control for applications that require it.

> You call these methods directly on the `InMemoryCache` object, not on the `ApolloClient` object.

## `cache.gc()`

The `gc` method removes all objects from the normalized cache that are not **reachable**:

```js
cache.gc();
```

 To determine whether an object is reachable, the cache starts from all known root objects and uses a tracing strategy to recursively visit all available child references. Any normalized objects that are _not_ visited during this process are removed. The `cache.gc()` method returns a list of the IDs of the removed objects.

### Configuring garbage collection

You can use the `retain` method to prevent an object (and its children) from being garbage collected, even if the object isn't reachable:

```js
cache.retain('my-object-id');
```

If you later want a `retain`ed object to be garbage collected, use the `release` method:

```js
cache.release('my-object-id');
```

If the object is unreachable, it will be garbage collected during next call to `gc`.

## `cache.evict()`

You can remove any normalized object from the cache using the `evict` method:

```js
cache.evict({ id: 'my-object-id' })
```

You can also remove a _single field_ from a cached object by providing the name of the field to remove:

```js
cache.evict({ id: 'my-object-id', fieldName: 'yearOfFounding' });
```

Evicting an object often makes _other_ cached objects unreachable. Because of this, you should call [`cache.gc`](#cachegc) after `evict`ing one or more objects from the cache.

## Dangling references

When an object is `evict`ed from the cache, references to that object might remain in _other_ cached objects. Apollo Client preserves these dangling references by default, because the referenced object might be written _back_ to the cache at a later time. This means the reference might still be useful.

You can customize behavior for dangling references by defining a custom [`read` function](./cache-field-behavior/#the-read-function) for any field that might contain one. This function can perform whatever cleanup is necessary when the field's referenced object is missing. For example, the `read` function might:

* Filter the referenced object out of a list of available objects
* Set the field's value to `null`
* Return a particular default value 

Every `read` function is passed a `canRead` function that helps it detect when its field currently contains a dangling reference.

The following code defines two `read` functions (one for `Query.ruler` and one for `Deity.offspring`) that both use `canRead`:

```js
new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        ruler(existingRuler, { canRead, toReference }) {
          // If there is no existing ruler, Apollo becomes the ruling deity
          return canRead(existingRuler) ? existingRuler : toReference({
            __typename: "Deity",
            name: "Apollo",
          });
        },
      },
    },

    Deity: {
      keyFields: ["name"],
      fields: {
        offspring(existingOffspring: Reference[], { canRead }) {
          // Filter out any dangling references left over from removing
          // offspring, supplying a default empty array if there are no
          // offspring left.
          return existingOffspring
            ? existingOffspring.filter(canRead)
            : [];
        },
      },
    },
  },
})
```

* The `read` function for `Query.ruler` returns a default ruler (Apollo) if the `existingRuler` has been deposed.
* The `read` function for `Deity.offspring` filters its array to return only offspring that are alive and well in the cache.

Filtering dangling references out of a cached array field (like the `Deity.offspring` example above) is so common that Apollo Client performs this filtering _automatically_ for array fields that don't define a `read` function. You can define a `read` function to override this behavior.

There isn't a similarly common solution for a field that contains a _single_ dangling reference (like the `Query.ruler` example above), so this is where writing a custom `read` function comes in handy most often.
