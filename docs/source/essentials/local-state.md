---
title: Local state management
description: Learn how to work with your local data in Apollo Client
---

We've learned how to manage remote data from our GraphQL server with Apollo Client, but what should we do with our local data? We want to be able to access boolean flags and device API results from multiple components in our app, but don't want to maintain a separate Redux or MobX store. Ideally, we would like the Apollo cache to be the single source of truth for all data in our client application.

Apollo Client (>= 2.5) has built-in local state handling capabilities, that allow you to store your local data inside the Apollo cache alongside your remote data. To access your local data, just query it with GraphQL. You can even request local and server data within the same query!

In this section, you'll learn how Apollo Client can help simplify local state management in your app. We'll cover how client-side resolvers can help us execute local queries and mutations. You'll also learn how to query and update the cache with the `@client` directive.

Please note that this documentation is intended to be used to familiarize yourself with Apollo Client's local state management capabilities, and serve as a reference guide. If you're looking for a step by step tutorial outlining how to handle local state with Apollo Client (and leverage other Apollo components to build a fullstack application), please refer to the [Apollo tutorial](https://www.apollographql.com/docs/tutorial/introduction).

> ⚠️ If you're interested in integrating local state handling capabilities with Apollo Client < 2.5, please refer to our (now deprecated) [`apollo-link-state`](https://github.com/apollographql/apollo-link-state) project. As of Apollo Client 2.5, local state handling is baked into the core, which means it is no longer necessary to use `apollo-link-state`. For help migrating from `apollo-link-state` to Apollo Client 2.5, please refer to the [Migrating from `apollo-link-state`](#migrating-from-apollo-link-state) section.

## Updating local state

There are two main ways to perform local state mutations. The first way is to directly write to the cache by calling `cache.writeData`. Direct writes are great for one-off mutations that don't depend on the data that's currently in the cache, such as writing a single value. The second way is by creating a `Mutation` component with a GraphQL mutation that calls a local client-side resolver. We recommend using resolvers if your mutation depends on existing values in the cache, such as adding an item to a list or toggling a boolean.

### Direct writes

Direct writes to the cache do not require a GraphQL mutation or a resolver function. They leverage your Apollo Client instance directly by accessing the `client` property within the render prop function of the `ApolloConsumer` or `Query` components. We recommend using this strategy for simple writes, such as writing a string, or one-off writes. It's important to note that direct writes are not implemented as GraphQL mutations under the hood, so you shouldn't include them in your schema. They also do not validate that the data you're writing to the cache is in the shape of valid GraphQL data. If either of these features are important to you, you should opt to use a local resolver instead.

Here's a direct write example using the `ApolloConsumer` component:

```jsx
import React from 'react';
import { ApolloConsumer } from 'react-apollo';

import Link from './Link';

const FilterLink = ({ filter, children }) => (
  <ApolloConsumer>
    {client => (
      <Link
        onClick={() => client.writeData({ data: { visibilityFilter: filter } })}
      >
        {children}
      </Link>
    )}
  </ApolloConsumer>
);
```

The `ApolloConsumer` render prop function is called with a single value, the Apollo Client instance. You can think of the `ApolloConsumer` component as being similar to the `Consumer` component from the [React context API](https://reactjs.org/docs/context.html). From the client instance, you can directly call `client.writeData` and pass in the data you'd like to write to the cache.

What if we want to immediately subscribe to the data we just wrote to the cache? Let's create an `active` property on the link that marks the link's filter as active if it's the same as the current `visibilityFilter` in the cache. To immediately subscribe to a client-side mutation, wrap it in a `Query` component instead of an `ApolloConsumer` component. The `Query` component also has the client instance exposed to its render prop function.

```jsx
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

import Link from './Link';

const GET_VISIBILITY_FILTER = gql`
  {
    visibilityFilter @client
  }
`;

const FilterLink = ({ filter, children }) => (
  <Query query={GET_VISIBILITY_FILTER}>
    {({ data, client }) => (
      <Link
        onClick={() => client.writeData({ data: { visibilityFilter: filter } })}
        active={data.visibilityFilter === filter}
      >
        {children}
      </Link>
    )}
  </Query>
);
```

You'll notice in our query that we have a `@client` directive next to our `visibilityFilter` field. This tells Apollo Client to fetch the field data locally (either from the cache or using a local resolver), instead of sending it to our GraphQL server. Once you call `client.writeData`, the query result on the render prop function will automatically update. All cache writes and reads are synchronous, so you don't have to worry about loading state.

### Local resolvers

If you'd like to implement your local state update as a GraphQL mutation, then you'll need to specify a function in your local resolver map. The resolver map is an object with resolver functions for each GraphQL object type. To visualize how this all lines up, it's useful to think of a GraphQL query or mutation as a tree of function calls for each field. These function calls resolve to data or another function call. So when a GraphQL query is run through Apollo Client, it looks for a way to essentially run functions for each field in the query. When it finds an `@client` directive on a field, it turns to its internal resolver map looking for a function it can run for that field.

To help make local resolvers more flexible, the signature of a resolver function is the exact same as resolver functions on the server built with [Apollo Server](https://www.apollographql.com/docs/apollo-server/essentials/data). Let's recap the four parameters of a resolver function:

```js
fieldName: (obj, args, context, info) => result;
```

1. `obj`: The object containing the result returned from the resolver on the parent field or the `ROOT_QUERY` object in the case of a top-level query or mutation.
2. `args`: An object containing all of the arguments passed into the field. For example, if you called a mutation with `updateNetworkStatus(isConnected: true)`, the `args` object would be `{ isConnected: true }`.
3. `context`: An object of contextual information shared between your React components and your Apollo Client network stack. In addition to any custom context properties that may be present, local resolvers always receive the following:
    - `context.client`: The Apollo Client instance.
    - `context.cache`: The Apollo Cache instance, which can be used to manipulate the cache with `context.cache.readQuery`, `.writeQuery`, `.readFragment`, `.writeFragment`, and `.writeData`. You can learn more about these methods in [Managing the cache](#managing-the-cache).
    - `context.getCacheKey`: Get a key from the cache using a `__typename` and `id`.
4. `info`: Information about the execution state of the query. You will probably never have to use this one.

Let's take a look at an example of a resolver where we toggle a todo's completed status:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Mutation: {
      toggleTodo: (_root, variables, { cache, getCacheKey }) => {
        const id = getCacheKey({ __typename: 'TodoItem', id: variables.id })
        const fragment = gql`
          fragment completeTodo on TodoItem {
            completed
          }
        `;
        const todo = cache.readFragment({ fragment, id });
        const data = { ...todo, completed: !todo.completed };
        cache.writeData({ id, data });
        return null;
      },
    },
  },
});
```

In order to toggle the todo's completed status, we first need to query the cache to find out what the todo's current completed status is. We do this by reading a fragment from the cache with `cache.readFragment`. This function takes a fragment and an id, which corresponds to the todo item's cache key. We get the cache key by calling the `getCacheKey` that's on the context and passing in the item's `__typename` and `id`.

Once we read the fragment, we toggle the todo's completed status and write the updated data back to the cache. Since we don't plan on using the mutation's return result in our UI, we return null since all GraphQL types are nullable by default.

Let's learn how to trigger our `toggleTodo` mutation from our component:

```jsx
import React from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: Int!) {
    toggleTodo(id: $id) @client
  }
`;

const Todo = ({ id, completed, text }) => (
  <Mutation mutation={TOGGLE_TODO} variables={{ id }}>
    {toggleTodo => (
      <li
        onClick={toggleTodo}
        style={{
          textDecoration: completed ? 'line-through' : 'none',
        }}
      >
        {text}
      </li>
    )}
  </Mutation>
);
```

First, we create a GraphQL mutation that takes the todo's id we want to toggle as its only argument. We indicate that this is a local mutation by marking the field with a `@client` directive. This will tell Apollo Client to call our local `toggleTodo` mutation resolver in order to resolve the field. Then, we create a `Mutation` component just as we would for a remote mutation. Finally, pass in your GraphQL mutation to your component and trigger it from within the UI in your render prop function.

## Querying local state

Querying for local data is very similar to querying your GraphQL server. The only difference is that you add a `@client` directive on your local fields to indicate they should be resolved from the Apollo Client cache or a local resolver function. Let's look at an example:

```jsx
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

import Todo from './Todo';

const GET_TODOS = gql`
  {
    todos @client {
      id
      completed
      text
    }
    visibilityFilter @client
  }
`;

const TodoList = () => (
  <Query query={GET_TODOS}>
    {({ data: { todos, visibilityFilter } }) => (
      <ul>
        {getVisibleTodos(todos, visibilityFilter).map(todo => (
          <Todo key={todo.id} {...todo} />
        ))}
      </ul>
    )}
  </Query>
);
```

Here we create our GraphQL query and add `@client` directives to `todos` and `visibilityFilter`. We then pass the query to our `Query` component. The `@client` directives here let the `Query` component know that `todos` and `visibilityFilter` should be pulled from the Apollo Client cache or resolved using pre-defined local resolvers. The following sections help explain how both options work in more detail.

> ⚠️ Since the above query runs as soon as the component is mounted, what do we do if there are no todos in the cache or there aren't any local resolvers defined to help calculate `todos`? We need to write an initial state to the cache before the query is run to prevent it from erroring out. Refer to the [Initializing the cache](#initializing-the-cache) section below for more information.

### Initializing the cache

Often, you'll need to write an initial state to the cache so any components querying data before a mutation is triggered don't error out. To accomplish this, you can use `cache.writeData` to prep the cache with initial values. The shape of your initial state should match how you plan to query it in your application.

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache();
const client = new ApolloClient({
  cache,
  resolvers: { /* ... */ },
});

cache.writeData({
  data: {
    todos: [],
    visibilityFilter: 'SHOW_ALL',
    networkStatus: {
      __typename: 'NetworkStatus',
      isConnected: false,
    },
  },
});
```

Sometimes you may need to [reset the store](/api/apollo-client/#ApolloClient.resetStore) in your application, when a user logs out for example. If you call `client.resetStore` anywhere in your application, you will likely want to initialize your cache again. You can do this using the `client.onResetStore` method to register a callback that will call `cache.writeData` again.

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache();
const client = new ApolloClient({
  cache,
  resolvers: { /* ... */ },
});

const data = {
  todos: [],
  visibilityFilter: 'SHOW_ALL',
  networkStatus: {
    __typename: 'NetworkStatus',
    isConnected: false,
  },
};

cache.writeData({ data });

client.onResetStore(() => cache.writeData({ data }));
```

### Local data query flow

When a query containing `@client` directives is executed, Apollo Client runs through a few sequential steps to try to find a result for the `@client` field. Let's use the following query to walk through the local data look up flow:

```js
const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {
      isInCart @client
      site
      rocket {
        type
      }
    }
  }
`;
```

This query includes a mixture of both remote and local fields. `isInCart` is the only field marked with an `@client` directive, so it's the field we'll focus on. When Apollo Client executes this query and tries to find a result for the `isInCart` field, it runs through the following steps:

1. Has a resolver function been set (either through the `ApolloClient` constructor `resolvers` parameter or Apollo Client's `setResolvers` / `addResolvers` methods) that is associated with the field name `isInCart`? If yes, run and return the result from the resolver function.
2. If a matching resolver function can't be found, check the Apollo Client cache to see if a `isInCart` value can be found directly. If so, return that value.

Let's look at both of these steps more closely.

- Resolving `@client` data with the help of local resolvers (step 1 above) is explained in [Handling `@client` fields with resolvers][].
- Loading `@client` data from the cache (step 2 above) is explained in [Handling `@client` fields with the cache](#handling-client-fields-with-the-cache).

### Handling `@client` fields with resolvers

Local resolvers are very similar to remote resolvers. Instead of sending your GraphQL query to a remote GraphQL endpoint, which then runs resolver functions against your query to populate and return a result set, Apollo Client runs locally defined resolver functions against any fields marked with the `@client` directive. Let's look at an example:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const GET_CART_ITEMS = gql`
  query GetCartItems {
    cartItems @client
  }
`;

const cache = new InMemoryCache(),
const client = new ApolloClient({
  cache,
  link: new HttpLink({
    uri: 'http://localhost:4000/graphql',
  }),
  resolvers: {
    Launch: {
      isInCart: (launch, _args, { cache }) => {
        const { cartItems } = cache.readQuery({ query: GET_CART_ITEMS });
        return cartItems.includes(launch.id);
      },
    },
  },
});

cache.writeData({
  data: {
    cartItems: [],
  },
});

const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {
      isInCart @client
      site
      rocket {
        type
      }
    }
  }
`;

// ... run the query using client.query, a <Query /> component, etc.
```

Here when the `GET_LAUNCH_DETAILS` query is executed, Apollo Client looks for a local resolver associated with the `isInCart` field. Since we've defined a local resolver for the `isInCart` field in the `ApolloClient` constructor, it finds a resolver it can use. This resolver function is run, then the result is calculated and merged in with the rest of the query result (if a local resolver can't be found, Apollo Client will check the cache for a matching field - see [Local data query flow](#local-data-query-flow) for more details).

Setting resolvers through `ApolloClient`'s constructor `resolvers` parameter, or through its `setResolvers` / `addResolvers` methods, adds resolvers to Apollo Client's internal resolver map (refer to the [Local resolvers](#local-resolvers) section for more details concerning the resolver map). In the above example we added a  `isInCart` resolver, for the `Launch` GraphQL object type, to the resolver map. Let's look at the `isInCart` resolver function more closely:

```js
  resolvers: {
    Launch: {
      isInCart: (launch, _args, { cache }) => {
        const { cartItems } = cache.readQuery({ query: GET_CART_ITEMS });
        return cartItems.includes(launch.id);
      },
    },
  },
```

`launch` holds the data returned from the server for the rest of the query, which means in this case we can use `launch` to get the current launch `id`. We aren't using any arguments in this resolver, so we can skip the second resolver parameter. From the `context` however (the third parameter), we're using the `cache` reference, to work directly with the cache ourselves. So in this resolver, we're making a call directly to the cache to get all cart items, checking to see if any of those loaded cart items matches the parent  `launch.id`, and returning `true` / `false` accordingly. The returned boolean is then incorporated back into the result of running the original query.

Just like resolvers on the server, local resolvers are extremely flexible. They can be used to perform any kind of local computation you want, before returning a result for the specified field. You can manually query (or write to) the cache in different ways, call other helper utilities or libraries to prep/validate/clean data, track statistics, call into other data stores to prep a result, etc.

#### Integrating `@client` into remote queries

While Apollo Client’s local state handling features can be used to work with local state exclusively, most Apollo based applications are built to work with remote data sources. To address this, Apollo Client supports mixing `@client` based local resolvers with remote queries, as well as using `@client` based fields as arguments to remote queries, in the same request.

The `@client` directive can be used on any GraphQL selection set or field, to identify that the result of that field should be loaded locally with the help of a local resolver:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const MEMBER_DETAILS = gql`
  query Member {
    member {
      name
      role
      isLoggedIn @client
    }
  }
`;

const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  cache: new InMemoryCache(),
  resolvers: {
    Member: {
      isLoggedIn() {
        return someInternalLoginVerificationFunction();
      }
    }
  },
});

// ... run the query using client.query, the <Query /> component, etc.
```

When the above `MEMBER_DETAILS` query is fired by Apollo Client (assuming we're talking to a network based GraphQL API), the `@client` `isLoggedIn` field is first stripped from the document, and the remaining query is sent over the network to the GraphQL API. After the query has been handled by the remote resolvers and the result is passed back to Apollo Client from the API, the `@client` parts of the original query are then run against any defined local resolvers, their results are merged with the network results, and the final resulting data is returned as the response to the original operation. So in the above example, `isLoggedIn` is stripped before the rest of the query is sent and handled by the network API, then when the results come back `isLoggedIn` is calculated by running the `isLoggedIn()` function from the resolver map. Local and network results are merged together, and the final response is made available to the application.

The `@client` directive can be used with entire selection sets as well:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const MEMBER_DETAILS = gql`
  query Member {
    member {
      name
      role
      session @client {
        isLoggedIn
        connectionCount
        errors
      }
    }
  }
`;

const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  cache: new InMemoryCache(),
  resolvers: {
    Member: {
      session() {
        return {
          __typename: 'Session',
          isLoggedIn: someInternalLoginVerificationFunction(),
          connectionCount: calculateOpenConnections(),
          errors: sessionError(),
        };
      }
    }
  },
});
```

Apollo Client supports the merging of local `@client` results and remote results for Queries, Mutations and Subscriptions.

#### Async local resolvers

Apollo Client supports asynchronous local resolver functions. These functions can either be `async` functions or ordinary functions that return a `Promise`. Asynchronous resolvers are useful when they need to return data from an asynchronous API.

> ⚠️ If you would like to hit a REST endpoint from your resolver, [we recommend checking out `apollo-link-rest`](https://github.com/apollographql/apollo-link-rest) instead, which is a more complete solution for using REST endpoints with Apollo Client.

For React Native and most browser APIs, you should set up a listener in a component lifecycle method and pass in your mutation trigger function as the callback instead of using an async resolver. However, an `async` resolver function is often the most convenient way to consume asynchronous device APIs:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { CameraRoll } from 'react-native';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Query: {
      async cameraRoll(_, { assetType }) {
        try {
          const media = await CameraRoll.getPhotos({
            first: 20,
            assetType,
          });

          return {
            ...media,
            id: assetType,
            __typename: 'CameraRoll',
          };
        } catch (e) {
          console.error(e);
          return null;
        }
      },
    },
  },
});
```

[`CameraRoll.getPhotos()`](https://facebook.github.io/react-native/docs/cameraroll.html#getphotos) returns a `Promise` resolving to an object with a `edges` property, which is an array of camera node objects, and a `page_info` property, which is an object with pagination information. This is a great use case for GraphQL, since we can filter down the return value to only the data that our components consume.

```js
import gql from 'graphql-tag';

const GET_PHOTOS = gql`
  query getPhotos($assetType: String!) {
    cameraRoll(assetType: $assetType) @client {
      id
      edges {
        node {
          image {
            uri
          }
          location {
            latitude
            longitude
          }
        }
      }
    }
  }
`;
```

### Handling `@client` fields with the cache

As outlined in [Handling `@client` fields with resolvers][], `@client` fields can be resolved with the help of local resolver functions. However, it's important to note that local resolvers are not always required when using an `@client` directive. Fields marked with `@client` can still be resolved locally, by pulling matching values out of the cache directly. For example:

[Handling `@client` fields with resolvers]: #handling-client-fields-with-resolvers

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { Query, ApolloProvider } from 'react-apollo';
import gql from 'graphql-tag';

import Pages from './pages';
import Login from './pages/login';

const cache = new InMemoryCache();
const client = new ApolloClient({
  cache,
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  resolvers: {},
});

cache.writeData({
  data: {
    isLoggedIn: !!localStorage.getItem('token'),
  },
});

const IS_LOGGED_IN = gql`
  query IsUserLoggedIn {
    isLoggedIn @client
  }
`;

ReactDOM.render(
  <ApolloProvider client={client}>
    <Query query={IS_LOGGED_IN}>
      {({data}) => (data.isLoggedIn ? <Pages /> : <Login />)}
    </Query>
  </ApolloProvider>,
  document.getElementById('root'),
);
```

In the above example, we first prep the cache using `cache.writeData` to store a value for the `isLoggedIn` field. We then run the `IS_LOGGED_IN` query via a React Apollo `Query` component, which includes an `@client` directive. When Apollo Client executes the `IS_LOGGED_IN` query, it first looks for a local resolver that can be used to handle the `@client` field. When it can't find one, it falls back on trying to pull the specified field out of the cache. So in this case, the `data` value passed into the `Query` component's render prop has a `isLoggedIn` property available, which includes the `isLoggedIn` result (`!!localStorage.getItem('token')`) pulled directly from the cache.

> ⚠️ If you want to use Apollo Client's `@client` support to query the cache without using local resolvers, you must pass an empty object into the `ApolloClient` constructor `resolvers` option. Without this Apollo Client will not enable its integrated `@client` support, which means your `@client` based queries will be passed to the Apollo Client link chain. You can find more details about why this is necessary [here](https://github.com/apollographql/apollo-client/pull/4499).

Pulling `@client` field values directly out of the cache isn't quite as flexible as local resolver functions, since local resolvers can perform extra computations before returning a result. Depending on your application's needs however, loading `@client` fields directly from the cache might be a simpler option. Apollo Client doesn't restrict combining both approaches, so feel free to mix and match. If the need arises, you can pull some `@client` values from the cache, and resolve others with local resolvers, all in the same query.

### Working with fetch policies

Before Apollo Client executes a query, one of the first things it does is check to see which [`fetchPolicy`](/api/apollo-client/#ApolloClient.query) it has been configured to use. It does this so it knows where it should attempt to resolve the query from first, either the cache or the network. When running a query, Apollo Client treats `@client` based local resolvers just like it does remote resolvers, in that it will adhere to its defined `fetchPolicy` to know where to attempt to pull data from first. When working with local resolvers, it's important to understand how fetch policies impact the running of resolver functions, since by default local resolver functions are not run on every request. This is because the result of running a local resolver is cached with the rest of the query result, and pulled from the cache on the next request. Let's look at an example:

```jsx
import React, { Fragment } from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

import { Loading, Header, LaunchDetail } from '../components';
import { ActionButton } from '../containers';

export const GET_LAUNCH_DETAILS = gql`
  query LaunchDetails($launchId: ID!) {
    launch(id: $launchId) {
      isInCart @client
      site
      rocket {
        type
      }
    }
  }
`;

export default function Launch({ launchId }) {
  return (
    <Query query={GET_LAUNCH_DETAILS} variables={{ launchId }}>
      {({ data, loading, error }) => {
        if (loading) return <Loading />;
        if (error) return <p>ERROR: {error.message}</p>;

        return (
          <Fragment>
            <Header image={data.launch.mission.missionPatch}>
              {data.launch.mission.name}
            </Header>
            <LaunchDetail {...data.launch} />
            <ActionButton {...data.launch} />
          </Fragment>
        );
      }}
    </Query>
  );
}
```

In the above example we're using a React Apollo `Query` component to run the `GET_LAUNCH_DETAILS` query. The `@client` based `isInCart` field is configured to pull its data from the following resolver:

```js
import { GET_CART_ITEMS } from './pages/cart';

export const resolvers = {
  Launch: {
    isInCart: (launch, _, { cache }) => {
      const { cartItems } = cache.readQuery({ query: GET_CART_ITEMS });
      return cartItems.includes(launch.id);
    },
  },
};
```

Let's assume we're starting with an empty cache. Since we haven't specified a `fetchPolicy` prop in our `Query` call, we're using Apollo Client's default `cache-and-network` `fetchPolicy`. This means when the `GET_LAUNCH_DETAILS` query is run, it checks the cache first to see if it can find a result. It's important to note that when the cache is checked the entire query is run against the cache, but any `@client` associated local resolvers are skipped (not run). So the cache is queried with the following (it's as if the `@client` directive was never specified):

```graphql
launch(id: $launchId) {
  isInCart
  site
  rocket {
    type
  }
}
```

In this case a result can't be extracted from the cache (since our cache is empty), so behind the scenes Apollo Client moves further down the query execution path. At its next step, it essentially splits the original query into two parts - the part that has `@client` fields and the part that will be fired over the network. Both parts are then executed - results are fetched from the network, and results are calculated by running local resolvers. The results from the local resolvers and from the network are then merged together, and the final result is written to the cache and returned. So after our first run, we now have a result in the cache for the original query, that includes data for both the `@client` parts and network parts of the query.

When the `GET_LAUNCH_DETAILS` query is run a second time, again since we're using Apollo Client's default `fetchPolicy` of `cache-and-network`, the cache is checked first for a result. This time a full result can be found for the query, so that result is returned to our `Query` component. Our `@client` field local resolvers aren't fired since the result we're looking for can already be extracted from the cache.

In a lot of situations treating local resolvers just like remote resolvers, by having them adhere to the same `fetchPolicy`, makes a lot of sense. Once you have the data you're looking for, which might have been fetched remotely or calculated using a local resolver, you can cache it and avoid recalculating/re-fetching it again on a subsequent request. But what if you're using local resolvers to run calculations that you need fired on every request? There are a few different ways this can be handled. You can switch your query to use a `fetchPolicy` that forces your entire query to run on each request, like `no-cache` or `network-only`. This will make sure your local resolvers fire on every request, but it will also make sure your network based query components fire on every request. Depending on your use case this might be okay, but what if you want the network parts of your query to leverage the cache, and just want your `@client` parts to run on every request? We'll cover a more flexible option for this in the [Forcing resolvers with `@client(always: true)`](#forcing-resolvers-with-clientalways-true) section.

### Forcing resolvers with `@client(always: true)`

Apollo Client leverages its cache to help reduce the network overhead required when constantly making requests for the same data. By default, `@client` based fields leverage the cache in the exact same manner as remote fields. After a local resolver is run, its result is cached alongside any remote results. This way the next time a query is fired that can find its results in the cache, those results are used, and any associated local resolvers are not fired again (until the data is either removed from the cache or the query is updated to use a `no-cache` or `network-only` `fetchPolicy`).

While leveraging the cache for both local and remote results can be super helpful in a lot of cases, it's not always the best fit. We might want to use a local resolver to calculate a dynamic value that needs to be refreshed on every request, while at the same time continue to use the cache for the network based parts of our query. To support this use case, Apollo Client's `@client` directive accepts an `always` argument, that when set to `true` will ensure that the associated local resolver is run on every request. Looking at an example:

```jsx
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Query: {
      isLoggedIn() {
        return !!localStorage.getItem('token');
      },
    },
  },
});

const IS_LOGGED_IN = gql`
  query IsUserLoggedIn {
    isLoggedIn @client(always: true)
  }
`;

// ... run the query using client.query, a <Query /> component, etc.
```

The `isLoggedIn` resolver above is checking to see if an authentication token exists in `localStorage`. In this example, we want to make sure that every time the `IS_LOGGED_IN` query is executed, the `isLoggedIn` local resolver is also fired, so that we have the most up to date login information. To do this, we're using a `@client(always: true)` directive in the query, for the `isLoggedIn` field. If we didn't include `always: true`, then the local resolver would fire based on the queries `fetchPolicy`, which means we could be getting back a cached value for `isLoggedIn`. Using `@client(always: true)` ensures that we're always getting the direct result of running the associated local resolver.

> ⚠️ Please consider the impact of using `@client(always: true)` carefully. While forcing a local resolver to run on every request can be useful, if that resolver is computationally expensive or has side effects, you could be negatively impacting your application. We recommend leveraging the cache as much as possible when using local resolvers, to help with application performance. `@client(always: true)` is helpful to have in your tool-belt, but letting local resolvers adhere to a query `fetchPolicy` should be the preferred choice.

While `@client(always: true)` ensures that a local resolver is always fired, it's important to note that if a query is using a `fetchPolicy` that leverages the cache first (`cache-first`, `cache-and-network`, `cache-only`), the query is still attempted to be resolved from the cache first, before the local resolver is fired.    This happens because `@client(always: true)` use could be mixed with normal `@client` use in the same query, which means we want part of the query to adhere to the defined `fetchPolicy`. The benefit of this is that anything that can be loaded from the cache first is made available to your `@client(always: true)` resolver function, as its [first parameter](#local-resolvers). So even though you've used `@client(always: true)` to identify that you want to always run a specific resolver, within that resolver you can look at the loaded cache values for the query, and decide if you want to proceed with running the resolver.

### Using `@client` fields as variables

Apollo Client provides a way to use an `@client` field result as a variable for a selection set or field, in the same operation. So instead of running an `@client` based query first, getting the local result, then running a second query using the loaded local result as a variable, everything can be handled in one request. This is achieved by combining the `@client` directive with the `@export(as: "variableName")` directive:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const query = gql`
  query currentAuthorPostCount($authorId: Int!) {
    currentAuthorId @client @export(as: "authorId")
    postCount(authorId: $authorId)
  }
`;

const cache = new InMemoryCache();
const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  cache,
  resolvers: {},
});

cache.writeData({
  data: {
    currentAuthorId: 12345,
  },
});

// ... run the query using client.query, the <Query /> component, etc.
```

In the example above, `currentAuthorId` is first loaded from the cache, then passed into the subsequent  `postCount` field as the `authorId` variable (specified by the `@export(as: "authorId")` directive). The `@export` directive can also be used on specific fields within a selection set, like:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const query = gql`
  query currentAuthorPostCount($authorId: Int!) {
    currentAuthor @client {
      name
      authorId @export(as: "authorId")
    }
    postCount(authorId: $authorId)
  }
`;

const cache = new InMemoryCache();
const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  cache,
  resolvers: {},
});

cache.writeData({
  data: {
    currentAuthor: {
      __typename: 'Author',
      name: 'John Smith',
      authorId: 12345,
    },
  },
});

// ... run the query using client.query, the <Query /> component, etc.
```

Here the `authorId` variable is set from the `authorId` field loaded from the cache stored `currentAuthor`. `@export` variable use isn't limited to remote queries; it can also be used to define variables for other `@client` fields or selection sets:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const query = gql`
  query currentAuthorPostCount($authorId: Int!) {
    currentAuthorId @client @export(as: "authorId")
    postCount(authorId: $authorId) @client
  }
`;

const cache = new InMemoryCache();
const client = new ApolloClient({
  cache,
  resolvers: {
    Query: {
      postCount(_, { authorId }) {
        return authorId === 12345 ? 100 : 0;
      },
    },
  },
});

cache.writeData({
  data: {
    currentAuthorId: 12345,
  },
});

// ... run the query using client.query, the <Query /> component, etc.
```

So here the `currentAuthorId` is loaded from the cache, then passed into the `postCount` local resolver as `authorId`.

**A few important notes about `@export` use:**

1. Apollo Client currently only supports using the `@export` directive to store variables for local data. `@export` must be used with `@client`.

2. `@client @export` use might appear to go against the GraphQL specification, given that the execution order of an operation looks like it could affect the result. From the [Normal and Serial Execution](https://graphql.github.io/graphql-spec/draft/#sec-Normal-and-Serial-Execution) section of the GraphQL spec:

  > ... the resolution of fields other than top‐level mutation fields must always be side effect‐free and idempotent, the execution order must not affect the result, and hence the server has the freedom to execute the field entries in whatever order it deems optimal.

  Apollo Client currently only supports the use of the `@export` directive when mixed with the `@client` directive. It prepares `@export` variables by first running through an operation that has `@client @export` directives, extracting the specified `@export` variables, then attempting to resolve the value of those variables from the local cache or local resolvers. Once a map of variable names to local values is built up, that map is then used to populate the variables passed in when running the server based GraphQL query. The execution order of the server based GraphQL query is not impacted by `@export` use; the variables are prepped and organized before the server query runs, so the specification is being followed.

3. If you define multiple `@export` variables that use the same name, in a single operation, the value of the last `@export` variable will be used as the variable value moving forward. When this happens Apollo Client will log a warning message (dev only).

## Managing the cache

When you're using Apollo Client to work with local state, your Apollo cache becomes the single source of truth for all of your local and remote data. The [Apollo cache API](/advanced/caching/) has several methods that can assist you with updating and retrieving data. Let's walk through the most relevant methods, and explore some common use cases for each one.

### writeData

The easiest way to update the cache is with `cache.writeData`, which allows you to write data directly to the cache without passing in a query. Here's how you use it in your resolver map for a simple update:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Mutation: {
      updateVisibilityFilter: (_, { visibilityFilter }, { cache }) => {
        const data = { visibilityFilter, __typename: 'Filter' };
        cache.writeData({ data });
      },
    },
  },
};
```

`cache.writeData` also allows you to pass in an optional `id` property to write a fragment to an existing object in the cache. This is useful if you want to add some client-side fields to an existing object in the cache.

The `id` should correspond to the object's cache key. If you're using the `InMemoryCache` and not overriding the `dataObjectFromId` config property, your cache key should be `__typename:id`.

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Mutation: {
      updateUserEmail: (_, { id, email }, { cache }) => {
        const data = { email };
        cache.writeData({ id: `User:${id}`, data });
      },
    },
  },
};
```

`cache.writeData` should cover most of your needs; however, there are some cases where the data you're writing to the cache depends on the data that's already there. In that scenario, you should use `readQuery` or `readFragment`, which allows you to pass in a query or a fragment to read data from the cache. If you'd like to validate the shape of your data that you're writing to the cache, use `writeQuery` or `writeFragment`. We'll explain some of those use cases below.

### writeQuery and readQuery

Sometimes, the data you're writing to the cache depends on data that's already in the cache; for example, you're adding an item to a list or setting a property based on an existing property value. In that case, you should use `cache.readQuery` to pass in a query and read a value from the cache before you write any data. Let's look at an example where we add a todo to a list:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';

let nextTodoId = 0;

const cache = new InMemoryCache();
cache.writeData({
  data: {
    todos: [],
  },
});

const client = new ApolloClient({
  resolvers: {
    Mutation: {
      addTodo: (_, { text }, { cache }) => {
        const query = gql`
          query GetTodos {
            todos @client {
              id
              text
              completed
            }
          }
        `;

        const previous = cache.readQuery({ query });
        const newTodo = { id: nextTodoId++, text, completed: false, __typename: 'TodoItem' };
        const data = {
          todos: [...previous.todos, newTodo],
        };

        // you can also do cache.writeData({ data }) here if you prefer
        cache.writeQuery({ query, data });
        return newTodo;
      },
    },
  },
});
```

In order to add our todo to the list, we need the todos that are currently in the cache, which is why we call `cache.readQuery` to retrieve them. `cache.readQuery` will throw an error if the data isn't in the cache, so we need to provide an initial state. This is why we're returning an empty array in our `Query.todos` resolver.

To write the data to the cache, you can use either `cache.writeQuery` or `cache.writeData`. The only difference between the two is that `cache.writeQuery` requires that you pass in a query to validate that the shape of the data you're writing to the cache is the same as the shape of the data required by the query. Under the hood, `cache.writeData` automatically constructs a query from the `data` object you pass in and calls `cache.writeQuery`.

### writeFragment and readFragment

`cache.readFragment` is similar to `cache.readQuery` except you pass in a fragment. This allows for greater flexibility because you can read from any entry in the cache as long as you have its cache key. In contrast, `cache.readQuery` only lets you read from the root of your cache.

Let's go back to our previous todo list example and see how `cache.readFragment` can help us toggle one of our todos as completed.

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  resolvers: {
    Mutation: {
      toggleTodo: (_, variables, { cache }) => {
        const id = `TodoItem:${variables.id}`;
        const fragment = gql`
          fragment completeTodo on TodoItem {
            completed
          }
        `;
        const todo = cache.readFragment({ fragment, id });
        const data = { ...todo, completed: !todo.completed };

        // you can also do cache.writeData({ data, id }) here if you prefer
        cache.writeFragment({ fragment, id, data });
        return null;
      },
    },
  },
});
```

In order to toggle our todo, we need the todo and its status from the cache, which is why we call `cache.readFragment` and pass in a fragment to retrieve it. The `id` we're passing into `cache.readFragment` refers to its cache key. If you're using the `InMemoryCache` and not overriding the `dataObjectFromId` config property, your cache key should be `__typename:id`.

To write the data to the cache, you can use either `cache.writeFragment` or `cache.writeData`. The only difference between the two is that `cache.writeFragment` requires that you pass in a fragment to validate that the shape of the data you're writing to the cache node is the same as the shape of the data required by the fragment. Under the hood, `cache.writeData` automatically constructs a fragment from the `data` object and `id` you pass in and calls `cache.writeFragment`.

## Client-side schema

You can optionally set a client-side schema to be used with Apollo Client, through either the `ApolloClient` constructor `typeDefs` parameter, or the local state API `setTypeDefs` method. Your schema should be written in [Schema Definition Language](https://www.apollographql.com/docs/graphql-tools/generate-schema#schema-language). This schema is not used for validation like it is on the server because the `graphql-js` modules for schema validation would dramatically increase your bundle size. Instead, your client-side schema is used for introspection in [Apollo Client Devtools](https://github.com/apollographql/apollo-client-devtools), where you can explore your schema in GraphiQL.

The following demonstrates how to configure a client-side schema through the `ApolloClient` constructor:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

const typeDefs = gql`
  extend type Query {
    isLoggedIn: Boolean!
    cartItems: [Launch]!
  }

  extend type Launch {
    isInCart: Boolean!
  }

  extend type Mutation {
    addOrRemoveFromCart(id: ID!): [Launch]
  }
`;

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
  typeDefs,
});
```

If you open up Apollo Client Devtools and click on the `GraphiQL` tab, you'll be able to explore your client schema in the "Docs" section. This example doesn't include a remote schema, but if it did, you would be able to see your local queries and mutations alongside your remote ones.

![GraphiQL Console](../assets/client-schema.png)

## Advanced

### Code splitting

Depending on the complexity and size of your local resolvers, you might not always want to define them up front, when you create your initial `ApolloClient` instance. If you have local resolvers that are only needed in a specific part of your application, you can leverage Apollo Client's [`addResolvers` and `setResolvers`](#methods) functions to adjust your resolver map at any point. This can be really useful when leveraging techniques like route based code-splitting, using something like [`react-loadable`](https://github.com/jamiebuilds/react-loadable).

Let's say we're building a messaging app and have a `/stats` route that is used return the total number of messages stored locally. If we use `react-loadable` to load our `Stats` component like:

```js
import Loadable from 'react-loadable';

import Loading from './components/Loading';

export const Stats = Loadable({
  loader: () => import('./components/stats/Stats'),
  loading: Loading,
});
```

and wait until our `Stats` component is called to define our local resolvers (using `addResolvers`):

```js
import React from 'react';
import { ApolloConsumer, Query } from 'react-apollo';
import gql from 'graphql-tag';

const GET_MESSAGE_COUNT = gql`
  {
    messageCount @client {
      total
    }
  }
`;

const resolvers = {
  Query: {
    messageCount: (_, args, { cache }) => {
      // ... calculate and return the number of messages in
      // the cache ...
      return {
        total: 123,
        __typename: 'MessageCount',
      };
    },
  },
};

const MessageCount = () => {
  return (
    <ApolloConsumer>
      {(client) => {
        client.addResolvers(resolvers);
        return (
          <Query query={GET_MESSAGE_COUNT}>
            {({ loading, data: { messageCount } }) => {
              if (loading) return 'Loading ...';
              return (
                <p>
                  Total number of messages: {messageCount.total}
                </p>
              );
            }}
          </Query>
        );
      }}
    </ApolloConsumer>
  );
};

export default MessageCount;
```

our local resolver code will only be included in the bundle a user downloads when (if) they access `/stats`. It won't be included in the initial application bundle, which helps keep the size of our initial bundle down, and ultimately helps with download and application startup times.

## Migrating from `apollo-link-state`

The [`apollo-link-state`](https://github.com/apollographql/apollo-link-state) project was the first to bring local state handling into the Apollo ecosystem. Handling local resolvers through the addition of an `ApolloLink` was a great starting point, and proved that `@client` based queries make sense, and work really well for local state management.

While `apollo-link-state` achieved some of the goals of local state handling, the information available when using any `ApolloLink` is limited by the modularity of the link system. We consider local state management a core part of the Apollo ecosystem, and as Apollo Client progresses, we want to make sure local resolvers are integrated as tightly as possible into core. This integration opens up new possibilities (like `@export` handling) and ties nicely into the future planned adjustments to cache data retention, invalidation, garbage collection, and other planned features that impact both local and remote data.

Updating your application to use Apollo Client's local state management features, instead of `apollo-link-state`, is fairly straightforward. The necessary steps are outlined below.

1. Including `apollo-link-state` as a dependency, and importing it to use `withClientState`, is no longer necessary. You can remove the `apollo-link-state` dependency since local state management is included with `apollo-client` >= 2.5.0.
2. Using `withClientState` is no longer supported. The following:

  ```js
  const cache = new InMemoryCache();
  const stateLink = withClientState({ cache, resolvers: { ... } });
  const link = ApolloLink.from([stateLink, new HttpLink({ uri: '...' })]);
  const client = new ApolloClient({
    cache,
    link,
  });
  ```
  becomes

  ```js
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: '...' }),
    resolvers: { ... },
  });
  ```

3. `defaults` are no longer supported. To prep the cache, use [`cache.writeData`](#writedata) directly instead. So

  ```js
  const cache = new InMemoryCache();
  const stateLink = withClientState({
    cache,
    resolvers: { ... },
    defaults: {
      someField: 'some value',
    },
  });
  const link = ApolloLink.from([stateLink, new HttpLink({ uri: '...' })]);
  const client = new ApolloClient({
    cache,
    link,
  });
  ```
  becomes:

  ```js
  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: new HttpLink({ uri: '...' }),
    resolvers: { ... },
  });
  cache.writeData({
    data: {
      someField: 'some value',
    },
  });
  ```

4. If you're using Apollo Boost, you shouldn't have to change anything. Apollo Boost has been updated to use Apollo Client's integrated local state handling, which means it is no longer using `apollo-link-state`. Behind the scenes, the Apollo Boost `clientState` constructor parameter now feeds the necessary local state initialization directly into Apollo Client.
5. Test thoroughly! 🙂

## Next steps

Managing your local data with Apollo Client can help simplify your state management code, since the Apollo cache becomes your single source of truth for all of the data in your application. If you'd like to learn more about Apollo Client's local state features, check out:

- The [Apollo tutorial](https://www.apollographql.com/docs/tutorial/introduction) which will not only show you how to use Apollo Client's local state features in a step by step manner, but will also guide you through using other Apollo components to build a fullstack application.
- The [Apollo community slack group](https://www.apollographql.com/slack), in particular the `#local-state` channel, is a great place to ask Apollo Client local state questions.
- Interested in suggesting or working on future changes to help make Apollo Client's local state management even better? We'd love the help! [Open a new feature request](https://github.com/apollographql/apollo-feature-requests) to kick start your feature discussion.
- Found a bug? Impossible! 🙈 Open a new issue in the [Apollo Client repo](https://github.com/apollographql/apollo-client), ideally with a small runnable reproduction, and someone from the community or Apollo team will help get it fixed.

## API

Apollo Client local state handling is baked in, so you don't have to install anything extra. Local state management can be configured during `ApolloClient` instantiation (via the `ApolloClient` constructor) or by using the `ApolloClient` local state API. Data in the cache can be managed through the `ApolloCache` API.

### ApolloClient

#### Constructor

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: { ... },
  typeDefs: { ... },
});
```

<dl>
  <dt>`resolvers?`: Resolvers | Resolvers[]</dt>
  <dd>A map of resolver functions that your GraphQL queries and mutations call in order to read and write to the cache.</dd>
  <dt>`typeDefs?`: string | string[] | DocumentNode | DocumentNode[];&lt;string&gt;</dt>
  <dd>A string representing your client-side schema written in the [Schema Definition Language](https://www.apollographql.com/docs/graphql-tools/generate-schema#schema-language). This schema is not used for validation, but is used for introspection by the [Apollo Client Devtools](https://github.com/apollographql/apollo-client-devtools).</dd>
</dl>

None of these options are required. If you don't specify anything, you will still be able to use the `@client` directive to query the Apollo Client cache.

#### Methods

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
});

client.setResolvers({ ... });
```

<dl>
  <dt>`addResolvers(resolvers: Resolvers | Resolvers[])`</dt>
  <dd>A map of resolver functions that your GraphQL queries and mutations call in order to read and write to the cache. Resolver functions added through `addResolvers` are added to the internal resolver function map, meaning any existing resolvers (that aren't overwritten) are preserved.</dd>
  <dt>`setResolvers(resolvers: Resolvers | Resolvers[])`: </dt>
  <dd>A map of resolver functions that your GraphQL queries and mutations call in order to read and write to the cache. Resolver functions added through `setResolvers` overwrite all existing resolvers (a pre-existing resolver map is wiped out, before the new resolvers are added).</dd>
  <dt>`getResolvers`</dt>
  <dd>Get the currently defined resolver map.</dd>
  <dt>`setLocalStateFragmentMatcher(fragmentMatcher: FragmentMatcher)`</dt>
  <dd>Set a custom `FragmentMatcher` to be used when resolving local state queries involving [fragments on unions or interfaces](/advanced/fragments#fragments-on-unions-and-interfaces).</dd>
</dl>

**Typescript interfaces/types:**

```ts
interface Resolvers {
  [key: string]: {
    [field: string]: (
      rootValue?: any,
      args?: any,
      context?: any,
      info?: any,
    ) => any;
  };
}

type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: any,
) => boolean;
```

### ApolloCache

#### Methods

```js
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache();
cache.writeData({
  data: {
    isLoggedIn: !!localStorage.getItem('token'),
    cartItems: [],
  },
});
```

<dl>
  <dt>`writeData({ id, data })`</dt>
  <dd>Write data directly to the root of the cache without having to pass in a query. Great for prepping the cache with initial data. If you would like to write data to an existing entry in the cache, pass in the entry's cache key to `id`.</dd>
  <dt>`writeQuery({ query, variables, data })`</dt>
  <dd>Similar to `writeData` (writes data to the root of the cache) but uses the specified query to validate that the shape of the data you’re writing to the cache is the same as the shape of the data required by the query.</dd>
  <dt>`readQuery({ query, variables })`</dt>
  <dd>Read data from the cache for the specified query.</dd>
  <dt>`writeFragment({ id, fragment, fragmentName, variables, data })`</dt>
  <dd>Similar to `writeData` (writes data to an existing entry in the cache) but uses the specified fragment to validate that the shape of the data you’re writing to the cache is the same as the shape of the data required by the fragment.</dd>
  <dt>`readFragment({ id, fragment, fragmentName, variables })`</dt>
  <dd>Read data from the cache for the specified fragment.</dd>
</dl>
