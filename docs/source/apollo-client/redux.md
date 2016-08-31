---
title: Redux integration
order: 153
description: How to integrate Apollo Client into your existing Redux store.
---

By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead. This will let you better track the different events that happen in your app, and how your client and server side data changes interleave.

<h2 id="creating-store">Creating the store</h2>

To integrate with your existing Redux store:

1. Create an `ApolloClient` instance.
2. Use [`combineReducers` from Redux](http://redux.js.org/docs/api/combineReducers.html) to combine `client.reducer()` with your other reducers. By default, the reducer expects to be attached under the `apollo` key in the store.
3. Pass your reducers to [Redux's `createStore`](http://redux.js.org/docs/api/createStore.html), and make sure to use `applyMiddleware` to add `client.middleware()` to your store.
4. Add `window.devToolsExtension` to your store if you would like to use the [Redux dev tools extension](https://github.com/zalmoxisus/redux-devtools-extension).

Here's what it looks like all together:

```js
import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import ApolloClient from 'apollo-client';
import { todoReducer, userReducer } from './reducers';

const client = new ApolloClient();

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    apollo: client.reducer(),
  }),
  compose(
    applyMiddleware(
      client.middleware(),
    ),
    window.devToolsExtension ? window.devToolsExtension() : f => f,
  )
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
  compose(
    applyMiddleware(
      client.middleware(),
    ),
    window.devToolsExtension ? window.devToolsExtension() : f => f,
  )
);

store.getState();

// Example initial state:
// {
//   todos: {},
//   users: {},
//   myDifferentKey: {},
// }
```

<h2 id="async-actions">Async Actions with thunk</h2>

In Redux, we handle asynchronity via the `thunk` middleware. This allows you to dispatch a function, instead of an Action Object. To integrate `thunk` into your workflow, follow the steps below:

1. Install `redux-thunk` from npm.
2. Include the middleware into your store initiation.

```js
import ReduxThunk from 'redux-thunk'

const client = new ApolloClient({
  reduxRootKey: 'myDifferentKey',
});

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    myDifferentKey: client.reducer(),
  }),
  compose(
    applyMiddleware(
      client.middleware(),
      ReduxThunk,
    ),
    window.devToolsExtension ? window.devToolsExtension() : f => f,
  )
);

```

Great! Now your store can dispatch functions. This will allow you to write more complex Action Creators.

Since 2.1.0, `Redux Thunk` supports injecting a custom argument using the withExtraArgument function. It is recommended we attach the `ApolloClient` into our middleware. This will allow you to have reference to `dispatch`, `getState`, and the `ApolloClient`:

```js
import ReduxThunk from 'redux-thunk'

const client = new ApolloClient({
  reduxRootKey: 'myDifferentKey',
});

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    myDifferentKey: client.reducer(),
  }),
  compose(
    applyMiddleware(
      client.middleware(),
      ReduxThunk.withExtraArgument(client),
    ),
    window.devToolsExtension ? window.devToolsExtension() : f => f,
  )
);

```

Now if we dispatch a function our Action Creator is enhanced:

```js
function fetchUser(id) {
  return (dispatch, getState, client) => {
    // you can use the apollo client here
    client.mutate(...).then((result) => {
        dispatch({
            type: 'SOME_UI_ACTION',
            data: result
        });
    });   
  }
}

```

<h2 id="using-thunk">Using thunk</h2>

Okay now that you understand the basics of `thunk`, let's go over dispatching an `Apollo` mutation.

```js
import gql from 'graphql-tag';

// let's write a function to generate our mutation params
// in our example we'll be updating the count of a counter
function generateMutationObject(id) {
  return {
    mutation: gql`
    mutation createCount($id: String) {
     incrementCount(id: $id)
    }`,
    variables: {
      id
    }
  };
}

```

Now we will write our `thunk`:

```js
function incrementCount(id) {
  return (dispatch, getState, client) => {
    // we have access to the client inside this function
    client.mutate(generateMutationObject(id)).then((result) => {
      if (result.data) {
        // if the mutation yields data, dispatch an action with that data
        return dispatch({
          type: "UPDATE_COUNT",
          data: result.data.incrementCount
        });
      }
    });
  };
}
```

Plug it into your UI

```js
import { connect } from 'react-redux';

function CounterButton({ dispatch }) {
    return (
        <button onClick={function () { return dispatch(incrementCount(1));}}>Click me!</button>
    );
}

export default connect()(CounterButton);
```
