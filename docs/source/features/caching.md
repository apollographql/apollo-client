---
title: Direct Cache Access
order: 109
description: Read and write functions for fine-grained cache access.
---

Apollo Client normalizes all of your data so that if any data you previously fetched from your GraphQL server is updated in a later data fetch from your server then your data will be updated with the latest truth from your server.

This normalization process is constantly happening behind the scenes when you call `watchQuery` or use a view integration library like [`react-apollo`](http://github.com/apollographql/react-apollo), but this process is often not enough to describe the updates to your data model as the result of a mutation. For example, if you wanted to add an item to the end of an array fetched by one of your queries. You also might want to read data from the normalized Apollo Client store at a specific id without making another GraphQL server fetch.

To interact directly with your data in the Apollo Client store you may use the methods `readQuery`, `readFragment`, `writeQuery`, and `writeFragment` that are accessible from the `ApolloClient` class. This article will teach you how to use these methods to control your data.

All of the methods we will discuss can be called from the `ApolloClient` class. Any code demonstration in this article will assume that we have already initialized an instance of `ApolloClient` and assigned it to the `client`, and that we have imported the `gql` tag from `graphql-tag`. Like so:

```js
import { ApolloClient } from 'apollo-client';
import gql from 'graphql-tag';

const client = new ApolloClient({ ... });
```

## `readQuery`

The `readQuery` method is very similar to the [`query` method on `ApolloClient`](/api/apollo-client/#ApolloClient.query) except that `readQuery` will _never_ make a request to your GraphQL server. The `query` method, on the other hand, may send a request to your server if the appropriate data is not in your cache whereas `readQuery` will throw an error if the data is not in your cache. `readQuery` will _always_ read from the cache. You can use `readQuery` by giving it a GraphQL query like so:

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

If all of the data needed to fulfill this read is in Apollo Client’s normalized data cache then a data object will be returned in the shape of the query you wanted to read. If not all of the data needed to fulfill this read is in Apollo Client’s cache then an error will be thrown instead, so make sure to only read data that you know you have!

You can also pass variables into `readQuery`.

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

**Resources:**

- [`ApolloClient#query` API documentation](/api/apollo-client/#ApolloClient.query)
- [`ApolloClient#readQuery` API documentation](/api/apollo-client/#ApolloClient.readQuery)

## `readFragment`

This method allows you great flexibility around the data in your cache. Whereas `readQuery` only allowed you to read data from your root query type, `readFragment` allows you to read data from _any node you have queried_. This is incredibly powerful. You use this method as follows:

```js
const todo = client.readFragment({
  id: ..., // `id` is any id that could be returned by `dataIdFromObject`.
  fragment: gql`
    fragment myTodo on Todo {
      id
      text
      completed
    }
  `,
});
```

The first argument is the id of the data you want to read from the cache. That id must be a value that was returned by the `dataIdFromObject` function you defined when initializing `ApolloClient`. So for example if you initialized `ApolloClient` like so:

```js
const client = new ApolloClient({
  ...,
  dataIdFromObject: object => object.id,
});
```

…and you requested a todo before with an id of `5`, then you can read that todo out of your cache with the following:

```js
const todo = client.readFragment({
  id: '5',
  fragment: gql`
    fragment myTodo on Todo {
      id
      text
      completed
    }
  `,
});
```

> **Note:** Most people add a `__typename` to the id in `dataIdFromObject`. If you do this then don’t forget to add the `__typename` when you are reading a fragment as well. So for example your id may be `Todo_5` and not just `5`.

If a todo with that id does not exist in the cache you will get `null` back. If a todo of that id does exist in the cache, but that todo does not have the `text` field then an error will be thrown.

The beauty of `readFragment` is that the todo could have come from anywhere! The todo could have been selected as a singleton (`{ todo(id: 5) { ... } }`), the todo could have come from a list of todos (`{ todos { ... } }`), or the todo could have come from a mutation (`mutation { createTodo { ... } }`). As long as at some point your GraphQL server gave you a todo with the provided id and fields `id`, `text`, and `completed` you can read it from the cache at any part of your code.

**Resources:**

- [`ApolloClient#readFragment` API documentation](/api/apollo-client/#ApolloClient.readFragment)

## `writeQuery` and `writeFragment`

Not only can you read arbitrary data from the Apollo Client cache, but you can also write any data that you would like to the cache. The methods you use to do this are `writeQuery` and `writeFragment`. They will allow you to change data in your local cache, but it is important to remember that *they will not change any data on your server*. If you reload your environment then changes made with `writeQuery` and `writeFragment` will disappear.

These methods have the same signature as their `readQuery` and `readFragment` counterparts except they also require an additional `data` variable. So for example, if you wanted to update the `completed` flag locally for your todo with id `'5'` you could execute the following:

```js
client.writeFragment({
  id: '5',
  fragment: gql`
    fragment myTodo on Todo {
      completed
    }
  `,
  data: {
    completed: true,
  },
});
```

Any subscriber to the Apollo Client store will instantly see this update and render new UI accordingly.

> **Note:** Again, remember that using `writeQuery` or `writeFragment` only changes data *locally*. If you reload your environment then changes made with these methods will no longer exist.

Or if you wanted to add a new todo to a list fetched from the server, you could use `readQuery` and `writeQuery` together.

```js
const query = gql`
  query MyTodoAppQuery {
    todos {
      id
      text
      completed
    }
  }
`;

const data = client.readQuery({ query });

const myNewTodo = {
  id: '6',
  text: 'Start using Apollo Client.',
  completed: false,
};

client.writeQuery({
  query,
  data: {
    todos: [...data.todos, myNewTodo],
  },
});
```

**Resources:**

- [`ApolloClient#watchQuery` API documentation](/api/apollo-client/#ApolloClient.watchQuery)
- [`ApolloClient#writeQuery` API documentation](/api/apollo-client/#ApolloClient.writeQuery)
- [`ApolloClient#writeFragment` API documentation](/api/apollo-client/#ApolloClient.writeFragment)
- [`DataProxy#writeQuery` API documentation](/api/apollo-client/#ApolloClient.writeQuery)
- [`DataProxy#writeFragment` API documentation](/api/apollo-client/#ApolloClient.writeFragment)

## Updating the cache after a mutation

Being able to read and write to the Apollo cache from anywhere in your application gives you a lot of power over your data. However, there is one place where we most often want to update our cached data: after a mutation. As such, Apollo Client has optimized the experience for updating your cache with the read and write methods after a mutation with the `update` function. Let us say that we have the following GraphQL mutation:

```graphql
mutation TodoCreateMutation($text: String!) {
  createTodo(text: $text) {
    id
    text
    completed
  }
}
```

We may also have the following GraphQL query:

```graphql
query TodoAppQuery {
  todos {
    id
    text
    completed
  }
}
```

At the end of our mutation we want our query to include the new todo like we had sent our `TodoAppQuery` a second time after the mutation finished without actually sending the query. To do this we can use the `update` function provided as an option of the `client.mutate` method. To update your cache with the mutation just write code that looks like:

```js
// We assume that the GraphQL operations `TodoCreateMutation` and
// `TodoAppQuery` have already been defined using the `gql` tag.

const text = 'Hello, world!';

client.mutate({
  mutation: TodoCreateMutation,
  variables: {
    text,
  },
  update: (proxy, { data: { createTodo } }) => {
    // Read the data from our cache for this query.
    const data = proxy.readQuery({ query: TodoAppQuery });

    // Add our todo from the mutation to the end.
    data.todos.push(createTodo);

    // Write our data back to the cache.
    proxy.writeQuery({ query: TodoAppQuery, data });
  },
});
```

The first `proxy` argument is an instance of `DataProxy` and has the same for methods that we just learned exist on the Apollo Client: `readQuery`, `readFragment`, `writeQuery`, and `writeFragment`. The reason we call them on a `proxy` object here instead of on our `client` instance is that we can easily apply optimistic updates (which we will demonstrate in a bit). The `proxy` object also provides an isolated transaction which shields you from any other mutations going on at the same time, and the `proxy` object also batches writes together until the very end.

If you provide an `optimisticResponse` option to the mutation then the `update` function will be run twice. Once immediately after you call `client.mutate` with the data from `optimisticResponse`. After the mutation successfully executes against the server the changes made in the first call to `update` will be rolled back and `update` will be called with the *actual* data returned by the mutation and not just the optimistic response.

Putting it all together:

```js
const text = 'Hello, world!';

client.mutate({
  mutation: TodoCreateMutation,
  variables: {
    text,
  },
  optimisticResponse: {
    id: -1, // -1 is a temporary id for the optimistic response.
    text,
    completed: false,
  },
  update: (proxy, { data: { createTodo } }) => {
    const data = proxy.readQuery({ query: TodoAppQuery });
    data.todos.push(createTodo);
    proxy.writeQuery({ query: TodoAppQuery, data });
  },
});
```

As you can see the `update` function on `client.mutate` provides extra change management functionality specific to the use case of a mutation while still providing you the powerful data control APIs that are available on `client`.

The `update` function is not a good place for side-effects as it may be called multiple times. Also, you may not call any of the methods on `proxy` asynchronously.

**Resources:**

- [`ApolloClient#mutate` API documentation](/api/apollo-client/#ApolloClient.mutate)
