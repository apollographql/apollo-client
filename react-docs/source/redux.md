---
title: Integrating with Redux
---


By default, Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead.

> Note: While this will enable Apollo Client to keep its data in the same store, you should still use the [graphql container](/react/higher-order-components.html) to attach the data to your UI. If you want to use your Redux and Apollo state in a component, you need to use _both_ `graphql` from react-apollo and `connect` from react-redux.

This will let you better track the different events that happen in your app, and how your client and server side data changes interleave. It will also make using tools like the [Redux Dev Tools](https://github.com/zalmoxisus/redux-devtools-extension) more natural.

<h2 id="creating-a-store">Creating a store</h2>

If you want to use your own store, you'll need to pass in reducer and middleware from your Apollo Client instance; you can then pass the store into your `ApolloProvider` directly:

```js
import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import { ApolloClient, ApolloProvider } from 'react-apollo';

import { todoReducer, userReducer } from './reducers';

const client = new ApolloClient();

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    apollo: client.reducer(),
  }),
  {}, // initial state
  compose(
      applyMiddleware(client.middleware()),
      // If you are using the devToolsExtension, you can add it here also
      (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') ? window.__REDUX_DEVTOOLS_EXTENSION__() : f => f,
  )
);

ReactDOM.render(
  <ApolloProvider store={store} client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  rootEl
)
```

If you'd like to use a different root key for the client reducer (rather than `apollo`), use the `reduxRootSelector: selector` option when creating the client:

```js
const client = new ApolloClient({
  reduxRootKey: state => state.differentKey,
});

const store = createStore(
  combineReducers({
    differentKey: client.reducer(),
  })
);
```

<h2 id="using-connect">Using connect</h2>

You can continue to use `react-redux`'s `connect` higher order component to wire state into and out of your components. You can connect before or after (or both!) attaching GraphQL data to your component with `graphql`:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import { connect } from 'react-redux';

import { CLONE_LIST } from './mutations';
import { viewList } from './actions';

const List = ({ listId, cloneList }) => (
  <div>List ID: {listId} <button onClick={cloneList}>Clone</button></div>
);

const withCloneList = graphql(CLONE_LIST, {
  props: ({ ownProps, mutate }) => ({
    cloneList() {
      return mutate()
        .then(result => {
          ownProps.onSelectList(result.id);
        });
    },
  }),
});
const ListWithData = withCloneList(List);

const ListWithDataAndState = connect(
  (state) => ({ listId: state.list.id }),
  (dispatch) => ({
    onSelectList(id) {
      dispatch(viewList(id));
    }
  }),
)(ListWithData);
```

This means you can easily pass variables into your queries that come from Redux state, or dispatch actions that rely on server-side data.
