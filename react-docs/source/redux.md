---
title: Integrating with Redux
order: 15
---

XXX: do we want to include James' stuff about MobX + React router?

Explain how to use custom reducers for Apollo Client-related data

We should use http://docs.apollostack.com/apollo-client/redux.html
and

If you are using a custom redux store, you can pass it into the `ApolloProvider`:

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
  applyMiddleware(client.middleware())
);

ReactDOM.render(
  <ApolloProvider store={store} client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  rootEl
)
```

You can continue to use `react-redux`'s `connect` higher order component to wire state into and out of your components. You can connect before or after (or both!) attaching GraphQL data to your component with `graphql`:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import { connect } from 'react-redux';

import { CLONE_LIST } from './mutations';
import { viewList } from './actions';

class List extends Component { ... }
List.propTypes = {
  listId: React.PropType.string.isRequired,
  cloneList: React.PropType.function.isRequired,
};

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
    viewList(id) {
      dispatch(viewList(id));
    }
  }),
)(ListWithData);
```
