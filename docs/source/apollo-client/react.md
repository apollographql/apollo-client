---
title: React and React Native
order: 150
description: How to use the Apollo Client to fetch GraphQL data in your React application.
---

> NOTE: this is the documentation for version 0.4 of the `react-apollo` package. The older version 0.3 documentation is available here: http://docs.apollostack.com/vreact-apollo-0.3/apollo-client/react.html

The `react-apollo` package gives a higher-order-component style interface to Apollo Client to allow you to easily integrate GraphQL data with your React components.

```txt
npm install react-apollo --save
```

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.


[Follow apollostack/react-apollo on GitHub.](https://github.com/apollostack/react-apollo)

<h2 id="apollo-provider">ApolloProvider</h2>

To get started, you should use an `ApolloProvider` to inject an [ApolloClient instance](../apollo-client/index.html#Initializing) into your React view heirarchy, *above* the point where you need GraphQL data.

```js
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

// you can provide whichever options you require to the apollo client here.
const client = new ApolloClient();

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  rootEl
)
```

To fetch data using the client, or send mutations, use the [`graphql`](#graphql) or [`withApollo`](#withApollo) higher order components.

<h2 id="graphql">The `graphql` container</h2>

The `graphql` container is the recommended approach for fetching data or making mutations. It is a [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects) for providing Apollo data to a component.

For queries, this means `graphql` handles the fetching and updating of information from the query using Apollo's [watchQuery method](../apollo-client/queries.html#watchQuery). For mutations, `graphql` binds the intended mutation to be called using Apollo.

The basic usage of `graphql` is as follows:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

// MyComponent is a "presentational" or apollo-unaware component,
// It could be a simple React class
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
// Or a stateless functional component:
const MyComponent = (props) => <div>...</div>;

// MyComponentWithData provides the query or mutation defined by
// QUERY_OR_MUTATION to MyComponent. We'll see how below.
const withData = graphql(QUERY_OR_MUTATION, options);
const MyComponentWithData = withData(MyComponent);
```

If you are using [ES2016 decorators](https://medium.com/google-developers/exploring-es7-decorators-76ecb65fb841#.nn723s5u2), you may prefer the decorator syntax, although we'll use the older syntax in this guide:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

@graphql(QUERY_OR_MUTATION, settings)
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
```

<h3 id="graphql-queries">For Queries</h3>

The first, and only required, argument of `graphql` is a [graphql](https://www.npmjs.com/package/graphql) document. Use the `gql` template literal you can get from [graphql-tag](../apollo-client/index.html#gql) which parses the query string.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component {
  render() {
    // By default the result of the query will be available at `props.data`
    const { loading, user } = this.props.data;
  }
}

MyComponent.propTypes = {
  // We'll see the precise shape of this object below
  data: React.PropTypes.object.isRequired,
};

const GET_USER = gql`
  query getUser {
    user { name }
  }
`;

const withUser = graphql(GET_USER);
const MyComponentWithData = withUser(MyComponent);
```

<h4 id="default-result-props">Default Result Props</h4>

Using `graphql` with queries makes it easy to bind data to components. As seen above, `graphql` will add the result of the query as `data` to the props passed to the wrapped component (it will also pass all of the props of the parent container). The shape of the `data` prop will be the following:

- `loading: Boolean`
  Loading will be true if a query is in flight (including when calling refetch)

- [`error: ApolloError`](http://docs.apollostack.com/apollo-client/queries.html#ApolloError)
  The error key will be `null` if no errors were created during the query

- `...fields`

  One key for each field selected on the root query, so:

  ```graphql
  query getUserAndLikes(id: $ID!) {
    user(userId: $id) { name }
    likes(userId: $id) { count }
  }
  ```

  could return a result object that includes `{ user: { name: "James" }, likes: { count: 10 } }`.

- [`...QuerySubscription`](../apollo-client/queries.html#QuerySubscription)

  The subscription created on this query will be merged into the passed props so you can dynamically refetch, change polling settings, or even unsubscribe to this query. The methods include `stopPolling`, `startPolling`, `refetch`, and `fetchMore`.


<h3 id="graphql-options">Providing `options`</h3>

If you want to configure the query (or the mutation, as we'll see below), you can provide an `options` function on the second argument to `graphql`:

```js
const withUser = graphql(GET_USER, {
  // Note ownProps here are the props that are passed into `MyComponentWithData`
  // when it is used
  options(ownProps) {
    return {
      // options for ApolloClient.watchQuery
    }
  }
});

const MyComponentWithData = withUser(MyComponent);
```

By default, `graphql` will attempt to pick up any missing variables from the query from `ownProps`. For example:

```js
import { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

const GET_USER_WITH_ID = gql`
  query getUser(id: $ID!) {
    user { name }
  }
`;
// Even though we haven't defined where `id` comes from, as long as we call
// `<MyComponentWithData id={something} />`, the default options() will work.
const withUserFromId = graphql(GET_USER_WITH_ID);
const MyComponentWithData = withUserFromId(MyComponent);
```

In general, you will probably want to be explicit about where the variables come from:

```js
// If we'd prefer to call `<MyComponentWithData userId={something} />`
const withUserFromId = graphql(GET_USER_WITH_ID, {
  options: (ownProps) => ({ variables: { id: ownProps.userId } })
});
const MyComponentWithData = withUserFromId(MyComponent);
```

Also, you may want to configure the [watchQuery](../apollo-client/queries.html#watchQuery) behaviour using `options`:

```js
const withPollingQuery = graphql(GET_USER_WITH_ID, {
  options: () => ({ pollInterval: 1000 })
});
const MyComponentWithData = withPollingQuery(MyComponent);
```

Sometimes you may want to skip a query based on the available information, to do this you can pass `skip: true` as part of the options. This is useful if you want to ignore a query if a user isn't authenticated:

```js
const withUser = graphql(GET_USER_DATA, {
  options: (ownProps) => ({ skip: !ownProps.authenticated })
});
const MyComponentWithData = withUser(MyComponent);
```

When the props change (a user logs in for instance), the query options will be rerun and `react-apollo` will start the watchQuery on the operation.

<h3 id="graphql-props">Controlling child props</h3>

As [we've seen](#default-result-props), by default, `graphql` will provide a `data` prop to the wrapped component with various information about the state of the query. We'll also see that [mutations](#graphql-mutations) provide a callback on the `mutate` prop.

<h4 id="graphql-name">Using `name`</h4>

If you want to change the name of this default property, you can use `name` field. In particular this is useful for nested `graphql` containers:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }
MyComponent.propTypes = {
  upvote: React.PropTypes.func.isRequired,
  downvote: React.PropTypes.func.isRequired,
};

// This provides an `upvote` callback prop to `MyComponent`
const withUpVote = graphql(UPVOTE, { name: 'upvote' });
const MyComponentWithUpvote = withUpVote(MyComponent);

// This provides an `downvote` callback prop to `MyComponentWithUpvote`,
// and subsequently `MyComponent`
const withDownVote = graphql(DOWNVOTE, { name: 'downvote' });
const MyComponentWithUpvoteAndDownvote = withDownVote(MyComponentWithUpvote);
```


<h4 id="graphql-props">Using `props`</h4>

If you want a greater level of control, use the `props` to map the query results (or mutation, as we'll see [below](#graphql-mutations)) to the props to be passed to the child component:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

MyComponent.propTypes = {
  loading: React.PropTypes.boolean,
  hasErrors: React.PropTypes.boolean,
  currentUser: React.PropTypes.object,
  refetchUser: React.PropTypes.func,
};

const GET_USER_WITH_ID = gql`
  query getUser(id: $ID!) {
    user { name }
  }
`;

const withUserFromId = graphql(GET_USER_WITH_ID, {
  // `ownProps` are the props passed into `MyComponentWithData`
  // `data` is the result data (see above)
  props: ({ ownProps, data }) => {
    if (data.loading) return { userLoading: true };
    if (data.error) return { hasErrors: true };
    return {
      currentUser: data.user,
      refetchUser: data.refetch,
    };
  }
});
const MyComponentWithData = withUserFromId(MyComponent);
```

This style of usage leads to the greatest decoupling between your presentational component (`MyComponent`) and Apollo.

<h3 id="graphql-mutations">For Mutations</h3>

Using `graphql` with mutations makes it easy to bind actions to components. Unlike queries, mutations provide only a simple prop (the `mutate` function) to the wrapped component. When calling a mutation, you can pass an options that can be passed to the Apollo Client [`mutate` method](../apollo-client/mutations.html#mutate).

Mutations will be passed to the child as `props.mutate`:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

MyComponent.propTypes = {
  mutate: React.PropTypes.func.isRequired,
};

const ADD_TASK = gql`
  mutation addTask($text: String!, $list_id: ID!) {
    addNewTask(text: $text, list_id: $list_id) {
      id
      text
      completed
      createdAt
    }
  }
`;

const withAddTask = graphql(ADD_TASK);
const MyComponentWithMutation = withAddTask(MyComponent);
```

<h4 id="calling-mutations">Calling mutations</h4>

Most mutations will require arguments in the form of query variables, and you may wish to provide other options to [ApolloClient#mutate](../apollo-client/mutations.html#mutate), such as `optimisticResponse` or `updateQueries`.

You can directly pass options to `mutate` when you call it in the wrapped component:

```js
import React, { Component } from 'react';

class MyComponent extends Component {
  render() {
    const onClick = () => {
      // pass in extra / changed variables
      this.props.mutate({ variables: { text: "task", list_id: 1 } })
        .then(({ data }) => {
          console.log('got data', data);
        }).catch((error) => {
          console.log('there was an error sending the query', error);
        });      
    }

    return <div onClick={onClick}>Click me</div>;
  }
}

MyComponent.propTypes = {
  mutate: React.PropTypes.func.isRequired,
};
```

However, typically you'd want to keep the concern of understanding the query out of your presentational component. The best way to do this is to use the [`props`](#graphql-props) argument to bind your mutate function:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component {
  render() {
    const onClick = () => {
      this.props.addTask("text");
    }

    return <div onClick={onClick}>Click me</div>;
  }
}

MyComponent.propTypes = {
  addTask: React.PropTypes.func.isRequired,
};

const ADD_TASK = ...;

const withAddTask = graphql(ADD_TASK, {
  props: ({ ownProps, mutate }) => ({
    addTask(text) {
      return mutate({
        variables: { text, list_id: 1 },
        optimisticResponse: {
          id: '123',
          text,
          completed:
          true,
          createdAt: new Date(),
        },

      // Depending on what you do it may make sense to deal with
      // the promise result in the container or the presentational component
      }).then(({ data }) => {
        console.log('got data', data);
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });     
    },
  })
});
const MyComponentWithMutation = withAddTask(MyComponent);
```

> Note that in general you shouldn't attempt to use the results from the mutation callback directly, but instead write a [`updateQueries`](../apollo-client/mutations.html#updating-query-results) callback to update the result of relevant queries with your mutation results.


<h4 name='with-ref'>withRef</h4>

If you need to get access to the instance of the wrapped component, you can use `withRef` in the options.
This will allow a `getWrappedInstance` method on the returned component which will return the wrapped instance.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }

const withUpvoteAndRef = graphql(UPVOTE, { withRef: 'true' });
const MyComponentWithUpvote = withUpvoteAndRef(MyComponent);

// MyComponentWithUpvote.getWrappedInstance() returns MyComponent instance
```

<h2 id="withApollo">The `withApollo` container</h2>

`withApollo` is a simple higher order component which provides direct access to your `ApolloClient` instance as a prop to your wrapped component. This is useful if you want to do custom logic with apollo, without using the `graphql` container.

```js
import React, { Component } from 'react';
import { withApollo } from 'react-apollo';
import ApolloClient from 'apollo-client';

const MyComponent = (props) => {
  // this.props.client is the apollo client
  return <div></div>
}
MyComponent.propTypes = {
  client: React.PropTypes.instanceOf(ApolloClient).isRequired;
}
const MyComponentWithApollo = withApollo(MyComponent);

// or, using ES2016 decorators:

@withApollo
class MyComponent extends Component {
  render() {
    return <div></div>
  }
}
```

<h2 id="server-methods">Server-side rendering and hydration</h2>

The `react-apollo` library supports integrated server side rendering for both store rehydration purposes, or fully rendered markup. No changes are required to client queries to support this, however, queries can be ignored during server rendering by passing `ssr: false` in the query options. For example:

```js
const withClientOnlyUser = graphql(GET_USER_WITH_ID, {
  options: () => ({ ssr: false }) // won't be called during SSR
});

const MyComponentWithData = withClientOnlyUser(MyComponent);
```


<h3 id="getDataFromTree">Using `getDataFromTree`</h3>

The `getDataFromTree` function takes your React tree and returns the context of you React tree. This can be used to get the initialState via `context.store.getState()`

```js
// server application code (custom usage)
import { getDataFromTree } from "react-apollo/server"

// during request
getDataFromTree(app).then((context) => {
  // markup with data from requests
  const markup = ReactDOM.renderToString(app);

  // now send the markup to the client alongside context.store.getState()
});
```

Your markup in this case can look something like:

```js
const dehydratedState =
  `window.__APOLLO_STATE__=${JSON.stringify(context.store.getState())};`;

ReactDOM.renderToStaticMarkup(
  <html>
    <body>
      <div id="content" dangerouslySetInnerHTML={{ __html: markup }} />
      <script dangerouslySetInnerHTML={{ __html: dehydratedState }} />
    </body>
  </html>
);
```

> Server notes:
  When creating the client on the server, it is best to use `ssrMode: true`. This prevents unneeded force refetching in the tree walking.

> Client notes:
  - When creating new client, you can pass `initialState: __APOLLO_STATE__` to [rehydrate](../apollo-client/index.html#store-rehydration) which will stop the client from trying to requery data.
  - If you are using `forceFetch`, pass `ssrForceFetchDelay: 100` on the client constructor to avoid force-fetching as the app boots up with dehydrated data.

<h3 id="renderToStringWithData">Using `renderToStringWithData`</h3>

The `renderToStringWithData` function takes your react tree and returns the stringified tree with all data requirements. It also injects a script tag that includes `window. __APOLLO_STATE__ ` which equals the full redux store for hydration. This method returns a promise that eventually returns the markup

```js
// server application code (integrated usage)
import { renderToStringWithData } from "react-apollo/server"

// during request
renderToStringWithData(app).then(markup => {
  // send markup to client
});
```

> See the notes above about `getDataFromTree`.

> Extra Client notes:
  - In this case, pass `initialState: JSON.parse(decodeURI(__APOLLO_STATE__))`
  - As of this writing, this technique will lead to a React warning "Target node has markup rendered by React, but there are unrelated nodes as well"---we're working on a better solution to this, but in the meantime if you want to avoid the error, use `getDataFromTree` directly.

<h2 id="redux">Using in concert with Redux</h2>

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

<h2 id="usage-with-immutable">Usage with ImmutableJs for redux store</h2>

```txt
npm install immutable redux-immutable --save
```

If you are using ImmutableJs or another form of immutable map as your redux store, `<ApolloProvider>` allows you to pass `immutable={true}` alongside your store to separate the apollo-client store. For example:

```js
import { Map } from 'immutable';
import { combineReducers } from 'redux-immutable';

const initialState = Map();
const store = createStore(combineReducers({ counter }), initialState);
const client = new ApolloClient();

// include the provider like so
<ApolloProvider store={store} client={client} immutable={true}><App></ApolloProvider>


// then somewhere in your app
const withConnect = connect((state) => ({ first: state.get('counter') }));
const withQuery = graphql(query)

class List extends Component { ... }
const ListWithDataAndImmutableState = withConnect(withQuery(List));
```

<h2 id="usage-with-redux-form">Usage with redux-form</h2>

```txt
npm install redux-form --save
```

`graphql` can be used to prefill fields for a redux-form form, or use the values from the store to set variables in a query. Both methods are shown below for example:

```js
import { reducer as formReducer, reduxForm } from 'redux-form';

// client and store setup
const client = new ApolloClient();
const store = createStore(
  combineReducers({
    apollo: client.reducer(),
    form: formReducer, // from redux form
  }),
  applyMiddleware(client.middleware())
);

// generic form component
class Container extends Component {
  render() {
    const { fields: { firstName }, handleSubmit } = this.props;
    return (
      <form onSubmit={handleSubmit}>
        <div>
          <label>First Name</label>
          <input type='text' placeholder='First Name' {...firstName}/>
        </div>
        <button type='submit'>Submit</button>
      </form>
    );
  }
};

/*

  using the form to call a query

*/
const withForm = reduxForm({ form: 'contact', fields: ['firstName'] })

const withQuery = graphql(query, {
  options: ({ fields }) => ({
    variables: { name: fields.firstName.value },
    skip: !fields.firstName.value, // until the field is filled in, the query won't be called
  }),
});

const ContainerWithFormAndQuery = withForm(withQuery(Container));


/*

  using the query to prefill the form

*/
const withQuery = graphql(query)

const withForm = reduxForm({
  form: 'contact',
  fields: ['firstName'],
}, (state, ownProps) => ({
  initialValues: {
    // ownProps.data is the result of the query
    firstName: ownProps.data.loading ? '' : ownProps.data.allPeople.people[0].name,
  },
}))

const ContainerWithQueryAndForm = withQuery(withFrom(Container));
```


<h2 id="usage-with-react-router">Usage with MobX</h2>

```txt
npm install mobx mobx-react --save
```

In order to use [MobX](https://mobxjs.github.io/mobx/) with Apollo, you will need to place the `@observer` after the `@graphql` decoration. Then within your component, use `componentWillReact` to call `refetch` on the query when data changes.

```js
import { Component } from 'react';
import ApolloClient from 'apollo-client';
import { observer } from 'mobx-react';

@graphql(MY_QUERY, {
  options: (props) => ({ variables: { first: props.appState.first } }),
})
@observer
class Container extends Component {
  componentWillReact() {
    this.props.data.refetch({ first: this.props.appState.first });
  }
  render() {
    return <div>{this.props.appState.first}</div>;
  }
};
```

<h2 id="usage-with-react-router">Usage with React Router</h2>

```txt
npm install react-router --save
```

In order to use [React Router](https://github.com/reactjs/react-router) with Apollo you need to render the `Router` component within an `ApolloProvider` component. That's all there is to it. You can find an introduction to React Router, advanced usage, and API documentation inside its [Github repository](https://github.com/reactjs/react-router/blob/master/docs/README.md).

```js
import React from 'react';
import ReactDOM from 'react-dom';
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';
import { Router, Route, browserHistory } from 'react-router';

const client = new ApolloClient();

const Home = () => (
  <div>
    The contents of your first route
  </div>
);

ReactDOM.render(
  <ApolloProvider client={client}>
    <Router history={browserHistory}>
      <Route path="/" component={Home}>
    </Router>
  </ApolloProvider>,
  root
);
```
