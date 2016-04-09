# Redux integration

By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead. This will let you better track the different events that happen in your app, and how your client and server side data changes interleave.

## Creating the store

To integrate with your existing Redux store:

1. Use Redux's `combineReducers`([docs](http://redux.js.org/docs/api/combineReducers.html)) function to combine Apollo's reducer with your own. apollo-client uses the `apollo` redux key by default
2. Pass the result to Redux's `createStore`([docs](http://redux.js.org/docs/api/createStore.html))
3. Pass the store when instantiating `ApolloClient`

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
// sample state
// {
//   todos: {},
//   users: {},
//   apollo: {},
// }
```

## Specify a different key

To use a key other than the default (`apollo`):

1. Specify it in your combined reducer
2. Use the `reduxRootKey` parameter when creating `ApolloClient`

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
// sample state
// {
//   todos: {},
//   users: {},
//   myDifferentKey: {},
// }
```
