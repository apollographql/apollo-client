---
title: Customization
order: 102
description: These are Apollo Docs!!
---

<h2 id="custom-network">Custom network interface</h2>

You can define a custom network interface and pass it to the Apollo Client to send your queries in a different way. You could use this for a variety of reasons:

1. You want a custom transport that sends queries over Websockets instead of HTTP
2. You want to modify the query or variables before they are sent
3. You want to run your app against a mocked client-side schema and never send any network requests at all

All you need to do is create a `NetworkInterface` and pass it to the `ApolloClient` constructor.

<h3 id="NetworkInterface">interface NetworkInterface</h3>

This is an interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: GraphQLRequest): Promise<GraphQLResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

<h3 id="GraphQLRequest">interface GraphQLRequest</h3>

Represents a request passed to the network interface. Has the following properties:

- `query: string` The query to send to the server.
- `variables: Object` The variables to send with the query.
- `debugName: string` An optional parameter that will be included in error messages about this query. XXX do we need this?

<h3 id="GraphQLResult">interface GraphQLResult</h3>

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.

<h2 id="redux">Redux integration</h2>

By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead. This will let you better track the different events that happen in your app, and how your client and server side data changes interleave.

### Creating the store

To integrate with your existing Redux store:

1. Create an `ApolloClient` instance.
2. Use [`combineReducers` from Redux](http://redux.js.org/docs/api/combineReducers.html) to combine `client.reducer()` with your other reducers. By default, the reducer expects to be attached under the `apollo` key in the store.
3. Pass your reducers to [Redux's `createStore`](http://redux.js.org/docs/api/createStore.html), and make sure to use `applyMiddleware` to add `client.middleware()` to your store.

Here's what it looks like all together:

```js
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { ApolloClient } from 'apollo-client';
import { todoReducer, userReducer } from './reducers';

const client = new ApolloClient();

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    apollo: client.reducer(),
  }),
  applyMiddleware(client.middleware())
);

store.getState();

// Example initial state:
// {
//   todos: {},
//   users: {},
//   apollo: {},
// }
```

### Custom store key

By default, the `ApolloClient` instance will assume that Apollo-related data lives under the `apollo` key in the store. To change the name of this key:

1. Specify the desired key when using `combineReducers` to attach `client.reducer()`.
2. Pass the `reduxRootKey` parameter to the `ApolloClient` constructor.

```js
const client = new ApolloClient({
  reduxRootKey: 'myDifferentKey',
});

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    myDifferentKey: client.reducer(),
  }),
  applyMiddleware(client.middleware())
);

store.getState();

// Example initial state:
// {
//   todos: {},
//   users: {},
//   myDifferentKey: {},
// }
```
