---
title: React integration
order: 110
description: How to use the Apollo Client to fetch GraphQL data in your React application.
---

This package allows you to easily integrate your Apollo client and Redux store with your React components. It works almost exactly like [react-redux](https://github.com/reactjs/react-redux).

```txt
npm install react-apollo --save
```

[Follow apollostack/react-apollo on GitHub.](https://github.com/apollostack/react-apollo)

<h2 id="provider">Provider</h2>

Injects an ApolloClient instance into a React view tree. You can use it instead of the Redux `Provider`, if you want to. But you don't have to:

Basic Apollo version:

```js
import ApolloClient from 'apollo-client';
import { Provider } from 'react-apollo';

const client = new ApolloClient();

ReactDOM.render(
  <Provider client={client}>
    <MyRootComponent />
  </Provider>,
  rootEl
)
```

With an existing Redux store:

```js
import { createStore, combineReducers, applyMiddleware } from 'redux';
import ApolloClient from 'apollo-client';
import { Provider } from 'react-apollo';

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
  <Provider store={store} client={client}>
    <MyRootComponent />
  </Provider>,
  rootEl
)
```

The wrapper is called `Provider` because in the base case you can use it instead of the Redux provider or you can use it as an Apollo enhanced Redux Provider.

<h2 id="connect">Connect</h2>


Works like Redux `connect`, but supports two more properties:

- `mapQueriesToProps` to connect GraphQL queries to fetch data
- `mapMutationsToProps` to connect mutations with your components

It also uses keyword arguments instead of positional arguments, since that lets you more easily omit certain fields when you don't need them.

Basic Apollo version:

```js
import { connect } from 'react-apollo';

import Category from '../components/Category';

function mapQueriesToProps({ ownProps, state }) {
  return {
    category: {
      query: `
        query getCategory($categoryId: Int!) {
          category(id: $categoryId) {
            name
            color
          }
        }
      `,
      variables: {
        categoryId: 5,
      },
      forceFetch: false,
      returnPartialData: true,
    },
  };
};

function mapMutationsToProps({ ownProps, state }) {
  return {
    postReply: (raw) => ({
      mutation: `
        mutation postReply(
          $topic_id: ID!
          $category_id: ID!
          $raw: String!
        ) {
          createPost(
            topic_id: $topic_id
            category: $category_id
            raw: $raw
          ) {
            id
            cooked
          }
        }
      `,
      variables: {
        // Use the container component's props
        topic_id: ownProps.topic_id,

        // Use the redux state
        category_id: state.selectedCategory,

        // Use an argument passed from the triggering of the mutation
        raw,
      },
    }),
  };
};

const CategoryWithData = connect({
  mapQueriesToProps,
  mapMutationsToProps,
})(Category);

export default CategoryWithData;
```

Each key on the object returned by mapQueriesToProps should be made up of the same possible arguments as [`ApolloClient#watchQuery`](index.html#watchQuery). In this case, the `Category` component will get a prop called `category`, which has the following keys:

```js
{
  loading: boolean,
  errors: Error[],
  refetch: Function(variables),
  getCategory: Data // only when the query has returned
}
```

`mapMutationsToProps` returns an object made up of keys and values that are custom functions to call the mutation. These can be used in children components (for instance, on a event handler) to trigger the mutation. The resulting function must return the same possible arguents as [`ApolloClient#mutate`](index.html#mutate). In this case, the `Category` component will get a prop called `postReply`, which has the following keys:

```js
{
  loading: boolean,
  errors: Error[],
  postReply: Data, // only when the muation has returned
}
```

The `Category` component will also get a prop of `mutations` that will have a key of `postReply`. This key is the method that triggers the mutation and can take custom arguments (e.g. `this.props.mutations.postReply('Apollo and React are really great!')`). These arguments are passed to the method that creates the mutation.

<h2 id="refetch">Refetch query (with new variables)</h2>

One typical pattern is wanting to refetch a query after a mutation has happened. In this example, `this.props.mutations.postReply`is a method that returns the mutation promise. Since queries pass a `refetch()` prop, this can be accomplished like so:

```js

@connect({ mapMutationsToProps, mapQueriesToProps })
class Container extends React.Component{
  componentDidMount() {
    // call the muation
    this.props.mutations.makeListPrivate()
      .then((err, data) => {
        // if we have the data we want
        if (data.id) {
          // refetch the categories query without variables,
          // just refresh client store
          this.props.categories.refetch();
        };
      });
  }

  render() {
    return <div />;
  }
};

```

`refetch(variables: optional)` also supports passing variables to refetch the same query with different set of variables. This would be handy for cases, when you just want to modify the variables to get new data.

**For example:**

```js
 this.props.categories.refetch({ id: 5 });
 this.props.posts.refetch({ first: 20, page: 2 });
```
Example use cases: `Infinite scroll`, `Data filtering`

*Note: If you just want to refresh the store with updated data, just `refetch()` without variables.*


<h2 id="additional-props">Additional Props</h2>

Redux's connect will pass `dispatch` as a prop unless action creators are passed using `mapDisptachToProps`. Likewise, the Apollo connect exposes part of the apollo-client api to props under the keys `query` and `mutate`. These correspond to the Apollo methods and can be used for custom needs outside of the ability of the wrapper component.

<h2 id="using-with-redux">Using in concert with Redux</h2>


```js
// ... same as above

function mapStateToProps({ state, ownProps }) {
  return {
    selectedCategory: state.selectedCategory,
  }
}

const CategoryWithData = connect({
  mapQueriesToProps,
  mapMutationsToProps,
  mapStateToProps,
})(Category);

export default CategoryWithData;
```

In this case, `CategoryWithData` gets two props: `category` and `selectedCategory`.
