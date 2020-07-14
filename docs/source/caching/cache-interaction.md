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

The `modify` method of `InMemoryCache` enables you to modify the values of individual cached fields or even delete fields entirely. Unlike `writeQuery` and `writeFragment`, `modify` circumvents any [`merge` functions](cache-field-behavior/#the-merge-function) you've defined, which means that fields are definitely overwritten with exactly the values you specify.

The `modify` method takes the ID of an entity to modify, along with a collection of **modifier functions** to execute. A modifier function applies to a single field. It takes its associated field's current cached value as a parameter and returns whatever value should replace it.

> If you don't provide a modifier function for a particular field, that field's value remains unchanged.

For example, here's how you might remove a specific `Comment` from a paginated `Thread.comments` array:

```js
const idToRemove = 'C1';

cache.modify({
  id: cache.identify(thread),
  fields: {
    comments(existingCommentRefs: Reference[], { readField }) {
      return existingCommentRefs.filter(
        commentRef => idToRemove !== readField('id', commentRef)
      );
    },
  },
});
```

In the above example we first use [`cache.identify`](#obtaining-an-objects-custom-id) to specify the `Thread` object in the cache we want to modify. Next we specify that the `comments` field of the `Thread` object, which points to an array of comments, should be adjusted such that any comment in the array with an `id` that matches `idToRemove` is filtered before the `comments` array is returned and written back into the cache.

Modifier functions (`comments` in the above) receive either the current value of the associated field in the cache (if modifying a single entity), or an array of references pointing to the field's current values in the cache (if modifying a list of entities), as the first parameter. In the example above `existingCommentRefs` is an array of comment references that the `comments` field points to in the cache, before the modifier function runs.

As the second parameter, modifier functions receive a cache utility object. In the example above, `readField` is a cache utility function extracted from the second parameter object, that can be used to get the value of a field from a specific object. `readField` is quite flexible, allowing you to retrieve field values from either an object directly, or from an object pointed to by a reference. `readField('id', commentRef)` looks the comment object up by reference, finds its `id`, and returns it.

It's important to note that any fields whose values change as a result of calling `cache.modify`, like `comments` in the above example, will trigger invalidation of cached queries that consume those fields. This means that any previous queries we've made that are watching for `comments` changes in the cache (using `useQuery` for example) will be notified of the `comments` changes we've made to the cache. If you would like to modify the cache without broadcasting the fact that changes have been made, you can disable broadcasting per `cache.modify` call through the `broadcast` option:

```js
cache.modify({
  id: '...'
  fields: {
    comments() {
      // ...
    },
  },
  // True by default
  broadcast: false,
});
```

Let's look at another example, this time covering how `cache.modify` can be used to add an item to a list in the cache:

```js
const newComment = {
  __typename: 'Comment',
  id: 'C3',
  text: 'Apollo Client is doctor recommended.',
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

      // Quick safety check - if the new comment was already
      // written to the cache, we don't need to add it again.
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

When the `comments` field modifier function is called, we first use `writeFragment` to store our `newComment` data in the cache. After the data is written to the cache, we get back a reference (`newCommentRef`) that points to this data in the cache. As a safety check, we then scan the array of existing comment references (`existingCommentRefs`) to make sure the new comment we've added to the cache hasn't already been added to the list of comments. If it hasn't, we add the new comment reference to the list of references, returning the full list to be updated in the cache.

It's important to note that `writeFragment` will only add data to the cache if an existing `===` object doesn't already exist in the cache. This means we can also use `writeFragment` to get a reference to an existing object in the cache. This can come in handy when using Apollo Client features like `useMutation` that might have already added the new data we're interested in working with. For example:

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

`useMutation` will automatically add the new comment to the cache as a standalone normalized entity, but it doesn't know how to update the list of comments in the cache. This means that even though we've added the new comment, any queries we have watching the list of comments in the cache won't be updated to show the new comment. To help address this, we're using `useMutation`'s `update` callback and `cache.modify` to update the list of comments in the cache, with the new comment. Since the comment was already added to the cache by `useMutation`, we're using `cache.writeFragment` to get its existing reference (and if it was somehow removed before we had a chance to read its reference, `writeFragment` will add it to the cache for us again).

Let's look at one more example, showing how `cache.modify` can be used to delete a field from a cached entity object:

```js
cache.modify({
  id: cache.identify(thread),
  fields: {
    comments(_, { DELETE }) {
      return DELETE;
    },
  },
});
```

The cache utility object that's passed into modifier functions as their second parameter contains several useful utilities, like `fieldName`, `canRead` and `isReference` (TODO: explain these in the cache API reference section and link to them). It also contains a `DELETE` sentinel object, which we're using above, that can be returned to delete a field from the entity object. When the `comments` modifier function above runs, it will remove all comments from the cache for the identified `Thread` object.

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
