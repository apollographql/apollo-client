---
title: Customization
order: 102
description: These are Apollo Docs!!
---

## Custom network interface

You can define a custom network interface and pass it to the Apollo Client to send your queries in a different way. You could use this for a variety of reasons:

1. You want a custom transport that sends queries over Websockets instead of HTTP
2. You want to modify the query or variables before they are sent
3. You want to run your app against a mocked client-side schema and never send any network requests at all

All you need to do is create a `NetworkInterface` and pass it to the `ApolloClient` constructor.

### NetworkInterface

This is an interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: GraphQLRequest): Promise<GraphQLResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

### GraphQLRequest

Represents a request passed to the network interface. Has the following properties:

- `query: string` The query to send to the server.
- `variables: Object` The variables to send with the query.
- `debugName: string` An optional parameter that will be included in error messages about this query. XXX do we need this?

### GraphQLResult

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.

<h2 id="redux">Redux integration</h2>

By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead. This will let you better track the different events that happen in your app, and how your client and server side data changes interleave.

### Creating the store

To integrate with your existing Redux store:

1. Use [`combineReducers` from Redux](http://redux.js.org/docs/api/combineReducers.html) to combine Apollo's reducer with your own. `apollo-client` uses the `apollo` redux key by default.
2. Pass the result to [Redux's `createStore`](http://redux.js.org/docs/api/createStore.html).
3. Pass the store into the `ApolloClient` constructor.

```js
import { createStore, combineReducers } from 'redux';
import { ApolloClient, apolloReducer } from 'apollo-client';
import { todoReducer, userReducer } from './reducers';

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    apollo: apolloReducer,
  })
});

const client = new ApolloClient({ store });

client.store.getState();

// Example initial state:
// {
//   todos: {},
//   users: {},
//   apollo: {},
// }
```

### Custom store key

By default, the `ApolloClient` instance will assume that Apollo-related data lives under the `apollo` key in the store. To change the name of this key:

1. Specify the desired key when adding `apolloReducer`.
2. Pass the `reduxRootKey` parameter to the `ApolloClient` constructor.

```js
const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    myDifferentKey: apolloReducer,
  })
});

const client = new ApolloClient({
  store,
  reduxRootKey: 'myDifferentKey',
});

client.store.getState();

// Example initial state:
// {
//   todos: {},
//   users: {},
//   myDifferentKey: {},
// }
```
