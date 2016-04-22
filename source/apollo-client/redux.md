---
title: Redux integration
order: 130
description: How to integrate Apollo Client into your existing Redux store.
---

By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead. This will let you better track the different events that happen in your app, and how your client and server side data changes interleave.

<h2 id="creating-store">Creating the store</h2>

To integrate with your existing Redux store:

1. Create an `ApolloClient` instance.
2. Use [`combineReducers` from Redux](http://redux.js.org/docs/api/combineReducers.html) to combine `client.reducer()` with your other reducers. By default, the reducer expects to be attached under the `apollo` key in the store.
3. Pass your reducers to [Redux's `createStore`](http://redux.js.org/docs/api/createStore.html), and make sure to use `applyMiddleware` to add `client.middleware()` to your store.

Here's what it looks like all together:

```js
import { createStore, combineReducers, applyMiddleware } from 'redux';
import ApolloClient from 'apollo-client';
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

<h2 id="custom-store-key">Custom store key</h2>

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

<h2 id="react-redux">react-redux</h2>

The `react-apollo` integration package is a drop-in replacement for `react-redux`, so if you are using Redux and Apollo together you don't need to have nested data containers. [Read the docs for `react-apollo` to see how to do this.](http://docs.apollostack.com/apollo-client/react.html)
