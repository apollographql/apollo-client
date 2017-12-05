---
title: Apollo Cache
description: A guide to customizing and directly accessing your Apollo cache
---


<h2>InMemoryCache</h2>

`apollo-cache-inmemory` is the default cache implementation for Apollo Client 2.0. `InMemoryCache` is a normalized data store that supports all of Apollo Client 1.0's features without the dependency on Redux.

In some instances, you may need to manipulate the cache directly, such as updating the store after a mutation. We'll cover some common use cases [here](#recipes).

<h3 id="installation">Installation</h3>

```bash
npm install apollo-cache-inmemory --save
```

After installing the package, you'll want to initialize the cache constructor. Then, you can pass in your newly created cache to ApolloClient.

```js
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import ApolloClient from 'apollo-client';

const cache = new InMemoryCache();

const client = new ApolloClient({
  link: new HttpLink(),
  cache
});
```

<h3 id="configuration">Configuration</h3>

The `InMemoryCache` constructor takes an optional config object with properties to customize your cache:

- addTypename: A boolean to determine whether to add __typename to the document (default: `true`)
- dataIdFromObject: A function that takes a data object and returns a unique identifier to be used when normalizing the data in the store. Learn more about how to customize `dataIdFromObject` in the [Normalization](#normalization) section.
- fragmentMatcher: By default, the `InMemoryCache` uses a heuristic fragment matcher. If you are using fragments on unions and interfaces, you will need to use an `IntrospectionFragmentMatcher`. For more information, please read [our guide to setting up fragment matching for unions & interfaces](../recipes/fragment-matching.html).
- cacheResolvers: A map of custom ways to resolve data from other parts of the cache.

<h3 id="normalization">Normalization</h3>

The `InMemoryCache` normalizes your data before saving it to the store by splitting the result into individual objects, creating a unique identifier for each object, and storing those objects in a flattened data structure. By default, `InMemoryCache` will attempt to use the commonly found primary keys of `id` and `_id` for the unique identifier if they exist along with `__typename` on an object.

If `id` and `_id` are not specified, or if `__typename` is not specified, `InMemoryCache` will fall back to the path to the object in the query, such as `ROOT_QUERY.allPeople.0` for the first record returned on the `allPeople` root query.
That would make data for given type scoped for `allPeople` query and other queries would have to fetch their own separate objects.

This "getter" behavior for unique identifiers can be configured manually via the `dataIdFromObject` option passed to the `InMemoryCache` constructor, so you can pick which field is used if some of your data follows unorthodox primary key conventions so it could be referenced by any query.

For example, if you wanted to key off of the `key` field for all of your data, you could configure `dataIdFromObject` like so:

```js
const cache = new InMemoryCache({
  dataIdFromObject: object => object.key || null
});
```
Note that Apollo Client doesn't add the type name to the cache key when you specify a custom `dataIdFromObject`, so if your IDs are not unique across all objects, you might want to include the `__typename` in your `dataIdFromObject`.

You can use different unique identifiers for different data types by keying off of the `__typename` property attached to every object typed by GraphQL.  For example:

```js
import { InMemoryCache, defaultDataIdFromObject } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  dataIdFromObject: object => {
    switch (object.__typename) {
      case 'foo': return object.key; // use `key` as the primary key
      case 'bar': return `bar:${object.blah}`; // use `bar` prefix and `blah` as the primary key
      default: return defaultDataIdFromObject(object); // fall back to default handling
    }
  }
});
```

<h2 id="direct">Direct Cache Access</h2>

To interact directly with your cache, you can use the Apollo Client class methods readQuery, readFragment, writeQuery, and writeFragment. These methods are available to us via the `DataProxy` interface. Accessing these methods will vary slightly based on your view layer implementation. If you are using React, you can wrap your component in the `withApollo` higher order component, which will give you access to `this.props.client`. From there, you can use the methods to control your data.

Any code demonstration in the following sections will assume that we have already initialized an instance of  `ApolloClient` and that we have imported the `gql` tag from `graphql-tag`.

<h3 id="readquery">readQuery</h3>

The `readQuery` method is very similar to the [`query` method on `ApolloClient`][] except that `readQuery` will _never_ make a request to your GraphQL server. The `query` method, on the other hand, may send a request to your server if the appropriate data is not in your cache whereas `readQuery` will throw an error if the data is not in your cache. `readQuery` will _always_ read from the cache. You can use `readQuery` by giving it a GraphQL query like so:

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

<h3 id="readfragment">readFragment</h3>

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
  cache: new InMemoryCache({
    ...,
    dataIdFromObject: object => object.id,
  }),
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

<h3 id="writequery-and-writefragment">writeQuery` and `writeFragment</h3>

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

<h2 id="recipes">Recipes</h2>

Here are some common situations where you would need to access the cache directly. If you're manipulating the cache in an interesting way and would like your example to be featured, please send in a pull request!

<h3 id="server">Server side rendering</h3>

First, you will need to initialize an `InMemoryCache` on the server and create an instance of `ApolloClient`. In the initial serialized HTML payload from the server, you should include a script tag that extracts the data from the cache.

```js
`<script>
  window.__APOLLO_STATE__=${JSON.stringify(cache.extract())}
</script>`
```

On the client, you can rehydrate the cache using the initial data passed from the server:

```js
cache: new Cache().restore(window.__APOLLO_STATE__)
```

If you would like to learn more about server side rendering, please check our our more in depth guide [here](../recipes/server-side-rendering.html).


