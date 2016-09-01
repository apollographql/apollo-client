---
title: Integrating with Redux
order: 25
---


By default, the Apollo Client creates its own internal Redux store to manage queries and their results. If you are already using Redux for the rest of your app, you can have the client integrate with your existing store instead.

This will let you better track the different events that happen in your app, and how your client and server side data changes interleave. It will also make using tools like the [Redux Dev Tools](https://github.com/zalmoxisus/redux-devtools-extension) more natural.

<h2 id="creating-a-store">Creating a Store</h2>

If you want to use your own store, you'll need to pass in reducer and middleware from your Apollo Client instance; you can then pass the store into your `ApolloProvider` directly:

```js
import { createStore, combineReducers, applyMiddleware } from 'redux';
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

import { todoReducer, userReducer } from './reducers';

const client = new ApolloClient();

const store = createStore(
  combineReducers({
    todos: todoReducer,
    users: userReducer,
    apollo: client.reducer(),
  }),
  applyMiddleware(client.middleware()),
  // If you are using the devToolsExtension, you can add it here also
  window.devToolsExtension ? window.devToolsExtension() : f => f,
);

ReactDOM.render(
  <ApolloProvider store={store} client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  rootEl
)
```

If you'd like to use a different root key for the client reducer (rather than `apollo`), use the `reduxRootKey: "key"` option when creating the client:

```js
const client = new ApolloClient({
  reduxRootKey: 'differentKey',
});

const store = createStore(
  combineReducers({
    differentKey: client.reducer(),
  })
);
```

<h2 id="using-connect">Using Connect</h2>


You can continue to use `react-redux`'s `connect` higher order component to wire state into and out of your components. You can connect before or after (or both!) attaching GraphQL data to your component with `graphql`:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import { connect } from 'react-redux';

import { CLONE_LIST } from './mutations';
import { viewList } from './actions';

const List = function({ listId, onSelectList });

const withCloneList = graphql(CLONE_LIST, {
  props: ({ ownProps, mutate }) => ({
    cloneList() {
      return mutate()
        .then(result => {
          ownProps.viewList(result.id);
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
