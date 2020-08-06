---
title: Reading and writing data to the cache
sidebar_title: Reading and writing
---

Apollo Client provides the following methods for reading and writing data to the cache:

* [`readQuery`](#readquery) and [`readFragment`](#readfragment) 
* [`writeQuery` and `writeFragment`](#writequery-and-writefragment)
* [`cache.modify`](#cachemodify) (a method of `InMemoryCache`)

These methods are described in detail below.

All code samples below assume that you have initialized an instance of  `ApolloClient` and that you have imported the `gql` function from `@apollo/client`.

## `readQuery`

The `readQuery` method enables you to run a GraphQL query directly on your cache.

* If your cache contains all of the data necessary to fulfill a specified query, `readQuery` returns a data object in the shape of that query, just like a GraphQL server does.

* If your cache _doesn't_ contain all of the data necessary to fulfill a specified query, `readQuery` throws an error. It _never_ attempts to fetch data from a remote server.

Pass `readQuery` a GraphQL query string like so:

```js
const { todo } = client.readQuery({
  query: gql`
    query ReadTodo {
      todo(id: 5) {
        id
        text
        completed
      }
    }
  `,
});
```

You can provide GraphQL variables to `readQuery` like so:

```js
const { todo } = client.readQuery({
  query: gql`
    query ReadTodo($id: Int!) {
      todo(id: $id) {
        id
        text
        completed
      }
    }
  `,
  variables: {
    id: 5,
  },
});
```

> **Do not modify the return value of `readQuery`.** The same object might be returned to multiple components. To update data in the cache, instead create a replacement object and pass it to [`writeQuery`](#writequery-and-writefragment).

## `readFragment`

The `readFragment` method enables you to read data from _any_ normalized cache object that was stored as part of _any_ query result. Unlike with `readQuery`, calls to `readFragment` do not need to conform to the structure of one of your data graph's supported queries.

Here's an example that fetches a particular item from a to-do list:

```js
const todo = client.readFragment({
  id: '5', // The value of the to-do item's unique identifier
  fragment: gql`
    fragment MyTodo on Todo {
      id
      text
      completed
    }
  `,
});
```

The first argument, `id`, is the value of the unique identifier for the object you want to read from the cache. By default, this is the value of the object's `id` field, but you can [customize this behavior](./cache-configuration/#generating-unique-identifiers).

In the example above: 

* If a `Todo` object with an `id` of `5` is _not_ in the cache,
`readFragment` returns `null`.
* If the `Todo` object _is_ in the cache but it's
missing either a `text` or `completed` field, `readFragment` throws an error.

## `writeQuery` and `writeFragment`

In addition to reading arbitrary data from the Apollo Client cache, you can _write_ arbitrary data to the cache with the `writeQuery` and `writeFragment` methods.

> **Any changes you make to cached data with `writeQuery` and `writeFragment` are  not pushed to your GraphQL server.** If you reload your environment, these changes will disappear.

These methods have the same signature as their `read` counterparts, except they require an additional `data` variable.

For example, the following call to `writeFragment` _locally_ updates the `completed` flag for a `Todo` object with an `id` of `5`:

```js
client.writeFragment({
  id: '5',
  fragment: gql`
    fragment MyTodo on Todo {
      completed
    }
  `,
  data: {
    completed: true,
  },
});
```

All subscribers to the Apollo Client cache (including all active queries) see this change and update your application's UI accordingly.

## Combining reads and writes

Combine `readQuery` and `writeQuery` to fetch currently cached data and make selective modifications to it. The example below creates a new `Todo` item and adds it your cached to-do list. Remember, this addition is _not_ sent to your remote server.

```js
// Query that fetches all existing to-do items
const query = gql`
  query MyTodoAppQuery {
    todos {
      id
      text
      completed
    }
  }
`;

// Get the current to-do list
const data = client.readQuery({ query });

// Create a new to-do item
const myNewTodo = {
  id: '6',
  text: 'Start using Apollo Client.',
  completed: false,
  __typename: 'Todo',
};

// Write back to the to-do list, appending the new item
client.writeQuery({
  query,
  data: {
    todos: [...data.todos, myNewTodo],
  },
});
```

## `cache.modify`

The `modify` method of `InMemoryCache` enables you to directly modify the values of individual cached fields, or even delete fields entirely.

* Like `writeQuery` and `writeFragment`, `modify` triggers a refresh of all active queries that depend on modified fields (unless you [override this behavior](#parameters)).
* _Unlike_ `writeQuery` and `writeFragment`, `modify` circumvents any [`merge` functions](cache-field-behavior/#the-merge-function) you've defined, which means that fields are always overwritten with exactly the values you specify.

### Parameters

The `modify` method takes the following parameters: 

* The ID of a cached object to modify (which we recommend obtaining with [`cache.identify`](#obtaining-an-objects-custom-id))
* A collection of **modifier functions** to execute (one for each field to modify)
* An optional `broadcast` boolean to disable automatic refresh of affected queries

A modifier function applies to a single field. It takes its associated field's current cached value as a parameter and returns whatever value should replace it.

```js
cache.modify({
  id: cache.identify(myObject),
  fields: {
    name(cachedName) {
      return cachedName.toUpperCase();
    },
  },
  /* broadcast: false // Include this to prevent automatic query refresh */
});
```

> If you don't provide a modifier function for a particular field, that field's cached value remains unchanged.

### Modifier function utilities

A modifier function can optionally take a second parameter, which is an object that contains several helpful utilities:

| Name | Description |
| ---- | ----------- |
| `DELETE` | The modifier function can return this sentinel object to delete the associated field from the cache. |
| `fieldName` | The name of the field this modifier function is being applied to. |
| `storeFieldName` | ??? |
| `readField` | A function that returns the value of a specified field from a provided object or object reference. |
| `canRead` | ??? |
| `isReference` | A function that returns `true` if a provided value is a reference to a cached object. |
| `toReference` | ??? |

The [first example below](#example-removing-an-item-from-a-list) uses the `readField` utility function.

### Example: Removing an item from a list

Let's say we have a blog application where each `Post` has an array of `Comment`s. Here's how we might remove a specific `Comment` from a paginated `Post.comments` array:

```js
const idToRemove = 'abc123';

cache.modify({
  id: cache.identify(myPost),
  fields: {
    comments(existingCommentRefs, { readField }) {
      return existingCommentRefs.filter(
        commentRef => idToRemove !== readField('id', commentRef)
      );
    },
  },
});
```

Let's break this down:

* In the `id` field, we use [`cache.identify`](#obtaining-an-objects-custom-id) to obtain the identifier of the cached `Post` object we want to remove a comment from.

* In the `fields` field, we provide an object that lists our modifier functions. In this case, we define a single modifier function (for the `comments` field).

* The `comments` modifier function takes our existing cached array of comments as a parameter (`existingCommentRefs`). It also takes the `readField` helper function, which helps you read the value of any cached field.

* The modifier function returns an array that filters out all comments with an ID that matches `idToRemove`. The returned array replaces the existing array in the cache.

### Example: Adding an item to a list

Now let's look at _adding_ a `Comment` to a `Post`:

```js
const newComment = {
  __typename: 'Comment',
  id: 'abc123',
  text: 'Great blog post!',
};

cache.modify({
  fields: {
    comments(existingCommentRefs = [], { readField }) {
      const newCommentRef = cache.writeFragment({
        data: newComment,
        fragment: gql`
          fragment NewComment on Comment {
            id
            text
          }
        `
      });

      // Quick safety check - if the new comment is already
      // present in the cache, we don't need to add it again.
      if (existingCommentRefs.some(
        ref => readField('id', ref) === newComment.id
      )) {
        return existingCommentRefs;
      }

      return [...existingCommentRefs, newCommentRef];
    }
  }
});
```

When the `comments` field modifier function is called, it first calls `writeFragment` to store our `newComment` data in the cache. The `writeFragment` function returns a reference(`newCommentRef`) that points to the newly cached comment.

As a safety check, we then scan the array of existing comment references (`existingCommentRefs`) to make sure that our new isn't already in the list. If it isn't, we add the new comment reference to the list of references, returning the full list to be stored in the cache.

### Example: Updating the cache after a mutation

If you call `writeFragment` with data that's identical (`===`) to an existing object in the cache, it returns a reference to the _existing_ object without writing any new data. This means we can use `writeFragment` to obtain a reference to an existing object in the cache. This can come in handy when using Apollo Client features like [`useMutation`](../data/mutations/), which might have already added data we're interested in working with. 

For example:

```js
const [addComment] = useMutation(ADD_COMMENT, {
  update(cache, { data: { addComment } }) {
    cache.modify({
      fields: {
        comments(existingCommentRefs = [], { readField }) {
          const newCommentRef = cache.writeFragment({
            data: addComment,
            fragment: gql`
              fragment NewComment on Comment {
                id
                text
              }
            `
          });
          return [...existingCommentRefs, newCommentRef];
        }
      }
    });
  }
});
```

In this example, `useMutation` automatically adds the newly created `Comment` to the cache, but it _doesn't_ automatically know how to add that `Comment` to the corresponding `Post`'s list of `comments`. This means that any queries watching the `Post`'s list of `comments` _won't_ update.

To address this, we use the [`update` callback](../data/mutations/#updating-the-cache-after-a-mutation) of `useMutation` to call `cache.modify`. Like the [previous example](#example-adding-an-item-to-a-list), we add the new comment to the list. _Unlike_ the previous example, the comment was already added to the cache by `useMutation`. Consequently, `cache.writeFragment` returns a reference to the existing object.

### Example: Deleting a field from a cached object

A modifier function's optional second parameter is an object that includes [several helpful utilities](#modifier-function-utilities), such as the `canRead` and `isReference` functions. It also includes a sentinel object called `DELETE`.

To delete a field from a particular cached object, return the `DELETE` sentinel object from the field's modifier function, like so:

```js
cache.modify({
  id: cache.identify(myPost),
  fields: {
    comments(existingCommentRefs, { DELETE }) {
      return DELETE;
    },
  },
});
```

## Obtaining an object's custom ID

If a type in your cache uses a [custom identifier](./cache-configuration/#customizing-identifier-generation-by-type), you can use the `cache.identify` method to obtain the identifier for an object of that type. This method takes an object and computes its ID based on both its `__typename` and its custom identifier field(s). This means you don't have to keep track of which fields make up each type's identifier.

### Example

Let's say we have a JavaScript representation of a cached GraphQL object, like this:

```js{3}
const invisibleManBook = {
  __typename: 'Book',
  isbn: '9780679601395', // This type's custom identifier
  title: 'Invisible Man',
  author: {
    __typename: 'Author',
    name: 'Ralph Ellison',
  },
};
```

If we want to interact with this object in our cache with methods like [`writeFragment`](#writequery-and-writefragment) or [`cache.modify`](#cachemodify), we need the object's identifier. Our `Book` type's identifier appears to be custom, because the `id` field isn't present.

Instead of needing to look up that our `Book` type uses the `isbn` field as its identifier, we can use the `cache.identify` method, like so:

```js{8}
const bookYearFragment = gql`
  fragment BookYear on Book {
    publicationYear
  }
`;

const fragmentResult = cache.writeFragment({
  id: cache.identify(invisibleManBook),
  fragment: bookYearFragment,
  data: {
    publicationYear: '1952'
  }
});
```

The cache knows that the `Book` type uses the `isbn` field for its identifier, so `cache.identify` can correctly populate the `id` field above.

This example is straightforward because our custom identifier uses a single field (`isbn`). But custom identifiers can consist of _multiple_ fields (such as both `isbn` _and_ `title`). This makes it much more challenging and repetitive to specify an object's custom ID _without_ using `cache.identify`.
