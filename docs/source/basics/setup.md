---
title: Setup and options - Simple and Advanced
---

<h2 id="installation">Simple Installation - With Apollo Boost</h2>

To get started quickly and easily with Apollo and React, you should use [`apollo-boost`](https://www.npmjs.com/package/apollo-boost).

> If you are first getting started with Apollo Client, Apollo Boost is the best package to start with, because it offers a preconfigured GraphQL Client for you! You'll notice within the docs, where we interchange `apollo-boost` and `apollo-client` packages. The `apollo-client` examples are for the more advanced use cases, the `apollo-boost` examples are for the simpler ones. 

If you are now ready to move forward with Apollo Boost, [then let's go to that section of the docs and get started](https://github.com/apollographql/apollo-client/blob/master/docs/source/essentials/get-started.md)! 

The rest of this page is for more advanced use cases and for those who want to dive into the deep end first. 

<h3 id="creating-client">Installation with Apollo Client - For Advanced Use</h3>

First, let's get our packages installed: 

```bash
# install the necessary packages
npm install apollo-client apollo-cache-inmemory apollo-link-http react-apollo graphql-tag graphql --save
```

Now, let's create an [`ApolloClient`](#ApolloClient) instance and point it at your GraphQL server directly with the `apollo-client` package:

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  // By default, this client will send queries to the
  //  `/graphql` endpoint on the same host
  link: new HttpLink(),
  cache: new InMemoryCache()
});
```

The client takes a variety of [options](#ApolloClient), but in particular, if you want to change the URL of the GraphQL server, you can customize your [`Apollo Link`](/docs/link):

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.example.com/graphql' }),
  cache: new InMemoryCache()
});
```

`ApolloClient` has some other options which control the behavior of the client, and we'll see examples of their use throughout this guide.


<h3 id="creating-provider">Creating a provider</h3>

To connect your client to your component tree, use an `ApolloProvider` component. We suggest putting the `ApolloProvider` somewhere high in your app, above any places where you need to access GraphQL data. For example, it could be outside of your root route component if you're using React Router.

```js
import { ApolloProvider } from 'react-apollo';
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  link: new HttpLink(),
  cache: new InMemoryCache()
});

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyAppComponent />
  </ApolloProvider>,
  document.getElementById('root')
)

```
<h3 id="gql">Creating Operations using `graphql-tag`</h3>

```js
import gql from 'graphql-tag';
```

The `gql` template tag is what you use to define GraphQL queries in your Apollo Client apps. It parses your GraphQL query into the [GraphQL.js AST format][] which may then be consumed by Apollo Client methods. Whenever Apollo Client is asking for a GraphQL query you will always want to wrap it in a `gql` template tag.

You can embed a GraphQL document containing only fragments inside of another GraphQL document using template string interpolation. This allows you to use fragments defined in one part of your codebase inside of a query define in a completely different file. See the example below for a demonstration of how this works.

[GraphQL.js AST format]: https://github.com/graphql/graphql-js/blob/d92dd9883b76e54babf2b0ffccdab838f04fc46c/src/language/ast.js
[`graphql-tag`]: https://www.npmjs.com/package/graphql-tag

**Example:**

Notice how in the `query` variable we not only include the `fragments` variable through template string interpolation (`${fragments}`), but we also include a spread for the `foo` fragment in our query.

```js
const fragments = gql`
  fragment foo on Foo {
    a
    b
    c
    ...bar
  }

  fragment bar on Bar {
    d
    e
    f
  }
`;

const query = gql`
  query {
    ...foo
  }

  ${fragments}
`;
```

For more information about using fragments, checkout the [guide](../advanced/fragments.html) and even some of the different ways to write GraphQL operations in your app using [babel](../recipes/babel.html) or [webpack](../recipes/webpack.html).

<h2 id="connecting-data">Requesting data</h2>

Apollo Client makes it super easy to request data using GraphQL. You can [read](./queries.html), [update](./mutations.html), and even [subscribe](../advanced/subscriptions.html) to whatever information your app needs using the client directly, or integrating it with your components.

<h3 id="basic-operations">Basic Operations</h3>
If you want to see how easy it is to fetch data from a GraphQL server with Apollo, you can use the `query` method on your client. It is as easy as this:

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';

const client = new ApolloClient({
  link: new HttpLink({ uri: 'https://q80vw8qjp.lp.gql.zone/graphql' }),
  cache: new InMemoryCache()
});

client.query({ query: gql`{ hello }` }).then(console.log);
```

<h3 id="in-your-ui">Describe your data</h3>
Most of the time, you want to use Apollo Client to fetch data for your UI which is even easier using the `graphql()` container from `react-apollo`. The `graphql()` container is the recommended approach for using Apollo with React and it is a React [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects).

The basic usage of `graphql()` is as follows:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

// here we create a query opearation
const MY_QUERY = gql`query { todos { text } }`;

// We then can use the graphql container to pass the query results returned by MY_QUERY
// to a component as a prop (and update them as the results change)
const MyComponentWithData = graphql(MY_QUERY)(props => <div>...</div>);

```

The overall idea of using `graphql` is to pair a description (GraphQL Operation) of data you want, with the presentation (React Component) you want to show to your users! That is what makes the API as simple as `graphql` + `(operation)` + `(component)`! Over the course of the rest of the docs, you will see the `graphql` function used almost everywhere as the best way to use Apollo and React together.

<h3 id="ready">Ready for more?</h3>
At this point you are ready to start building something with Apollo! Checkout the [queries](./queries.html) guide to start writing queries instead of a lot of code to get your data!

<h2 id="api" title="API Reference">API Reference</h2>

<h3 id="ApolloClient">`ApolloClient`</h3>
The Apollo Client constructor takes a small number of options, of which two are required. These arguments make it easy to customize how Apollo works based on your environment or application needs.

- `link`: Apollo Client requires an Apollo Link to serve as the network layer. For more information about creating links, read the [docs](/docs/link).
- `cache`: The second required argument for using Apollo Client is an instance of an Apollo Cache. The default cache is the `apollo-cache-inmemory` which exports an `{ InMemoryCache }`. For more information read the [cache docs](../advanced/caching.html).
- `ssrMode`: When using the client for [server side rendering](../features/server-side-rendering.html), pass `ssrMode` as `true` so that React Apollo's `getDataFromTree` can work effectively.
- `ssrForceFetchDelay`: determines the time interval before Apollo Client force fetchs queries after a server side render.
- `connectToDevTools`: This argument allows the [Apollo Client Devtools](../features/developer-tooling.html) to connect to your application's Apollo Client. You can set this to be `true` to use the tools in production (they are on by default in dev mode).
- `queryDeduplication`: If set to false, this argument will force a query to still be sent to the server even if a query with identical parameters (query, variables, operationName) is already in flight.
- `defaultOptions`: If you want to set application wide defaults for the options supplied to `watchQuery`, `query`, or `mutate`, you can pass them as a `defaultOptions` object. An example object looks like this:

```js
const defaultOptions = {
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore',
  },
  query: {
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  },
  mutate: {
    errorPolicy: 'all'
  }
}
```

These options will be merged with options supplied with each request.


<h3 id="ApolloProvider" title="ApolloProvider">`ApolloProvider`</h3>
React-Apollo includes a component for providing a client instance to a React component tree, and a higher-order component for retrieving that client instance.

```js
import { ApolloProvider } from 'react-apollo';
```

Makes the GraphQL client available to any of your components enhanced by the `graphql()` function. The `<ApolloProvider/>` component works the same as the [`react-redux` `<Provider/>` component][]. It provides an [`ApolloClient`][] instance to all of your GraphQL components that either use the [`graphql()`](#graphql) function, or the [`withApollo`](#withApollo) function.

If you do not add this component to the root of your React tree then your components enhanced with Apollo capabilities will not be able to function.


The `<ApolloProvider/>` component takes the following props:

- `client`: The required [`ApolloClient`][] instance. This [`ApolloClient`][] instance will be used by all of your components enhanced with GraphQL capabilties.

If you want to get direct access to your [`ApolloClient`][] instance that is provided by `<ApolloProvider/>` in your components then be sure to look at the [`withApollo()`](#withApollo) enhancer function.

**Example:**

```js
ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  document.getElementById('root'),
);
```

<h3 id="graphql" title="graphql(...)">`graphql(query, [config])(component)`</h3>

```js
import { graphql } from 'react-apollo';
```

The `graphql()` function is the most important thing exported by `react-apollo`. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql()` function returns a function which will “enhance” any component with reactive GraphQL capabilities. This follows the React [higher-order component][] pattern which is also used by [`react-redux`’s `connect`][] function.

[higher-order component]: https://facebook.github.io/react/docs/higher-order-components.html
[`react-redux`’s `connect`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options

The `graphql()` function may be used like this:

```js
function TodoApp({ data: { todos } }) {
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}

export default graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)(TodoApp);
```

You may also define an intermediate function and hook up your component with the `graphql()` function like this:

```js
// Create our enhancer function.
const withTodoAppQuery = graphql(gql`query { ... }`);

// Enhance our component.
const TodoAppWithData = withTodoAppQuery(TodoApp);

// Export the enhanced component.
export default TodoAppWithData;
```

The `graphql()` function will only be able to provide access to your GraphQL data if there is a [`<ApolloProvider/>`](#ApolloProvider) component higher up in your tree to provide an [`ApolloClient`][] instance that will be used to fetch your data.

[`ApolloClient`]: #ApolloClient

The behavior of your component enhanced with the `graphql()` function will be different depending on if your GraphQL operation is a [query](./queries.html), a [mutation](./mutations.html), or a [subscription](../advanced/subscriptions.html). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object.

<h2 id="graphql-config">Query Configuration</h2>

The `config` object is the second argument you pass into the `graphql()` function, after your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

<h3 id="graphql-config-options">`config.options`</h3>

`config.options` is an object or a function that allows you to define the specific behavior your component should use in handling your GraphQL data.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql()`. There are options specific to [queries](./queries.html#graphql-query-options) and [mutations](./mutations.html#graphql-mutation-options).

You can define `config.options` as a plain object, or you can compute your options from a function that takes the component’s props as an argument.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`{ ... }`, {
  options: (props) => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

<h3 id="graphql-config-props">`config.props`</h3>

The `config.props` property allows you to define a map function that takes your props including the props added by the `graphql()` function ([`props.data`](#graphql-query-data) for queries and [`props.mutate`](#graphql-mutation-mutate) for mutations) and allows you to compute a new props object that will be provided to the component that `graphql()` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose][] providing the same benefits without the need for another library.

[`mapProps` from Recompose]: https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

Another benefit of `config.props` is that it also allows you to decouple your pure UI components from your GraphQL and Apollo concerns. You can write your pure UI components in one file and then keep the logic required for them to interact with the store in a completely different place in your project. You can accomplish this by your pure UI components only asking for the props needed to render and `config.props` can contain the logic to provide exactly the props your pure component needs from the data provided by your GraphQL API.

**Example:**

This example uses [`props.data.fetchMore`](#graphql-query-data-fetchMore).

```js
export default graphql(gql`{ ... }`, {
  props: ({ data: { fetchMore } }) => ({
    onLoadMore: () => {
      fetchMore({ ... });
    },
  }),
})(MyComponent);

function MyComponent({ onLoadMore }) {
  return (
    <button onClick={onLoadMore}>
      Load More!
    </button>
  );
}
```

<h3 id="graphql-config-skip">`config.skip`</h3>

If `config.skip` is true then all of the React Apollo code will be skipped *entirely*. It will be as if the `graphql()` function were a simple identity function. Your component will behave as if the `graphql()` function were not there at all.

Instead of passing a boolean to `config.skip`, you may also pass a function to `config.skip`. The function will take your components props and should return a boolean. If the boolean returns true then the skip behavior will go into effect.

`config.skip` is especially useful if you want to use a different query based on some prop. You can see this in an example below.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  skip: props => !!props.skip,
})(MyComponent);
```

The following example uses the [`compose()`](#compose) function to use multiple `graphql()` enhancers at once.

```js
export default compose(
  graphql(gql`query MyQuery1 { ... }`, { skip: props => !props.useQuery1 }),
  graphql(gql`query MyQuery2 { ... }`, { skip: props => props.useQuery1 }),
)(MyComponent);

function MyComponent({ data }) {
  // The data may be from `MyQuery1` or `MyQuery2` depending on the value
  // of the prop `useQuery1`.
  console.log(data);
}
```

<h3 id="graphql-config-name">`config.name`</h3>

This property allows you to configure the name of the prop that gets passed down to your component. By default if the GraphQL document you pass into `graphql()` is a query then your prop will be named [`data`](#graphql-query-data). If you pass a mutation then your prop will be named [`mutate`](#graphql-mutation-mutate). While appropriate these default names collide when you are trying to use multiple queries or mutations with the same component. To avoid collisions you may use `config.name` to provide the prop from each query or mutation HOC a new name.

**Example:**

This example uses the [`compose`](#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`mutation (...) { ... }`, { name: 'createTodo' }),
  graphql(gql`mutation (...) { ... }`, { name: 'updateTodo' }),
  graphql(gql`mutation (...) { ... }`, { name: 'deleteTodo' }),
)(MyComponent);

function MyComponent(props) {
  // Instead of the default prop name, `mutate`,
  // we have three different prop names.
  console.log(props.createTodo);
  console.log(props.updateTodo);
  console.log(props.deleteTodo);

  return null;
}
```

<h3 id="graphql-config-withRef">`config.withRef`</h3>

By setting `config.withRef` to true you will be able to get the instance of your wrapped component from your higher-order GraphQL component using a `getWrappedInstance` method available on the instance of your higher-order GraphQL component.

You may want to set this to true when you want to call functions or get access to properties that are defined on your wrapped component’s class instance.

Below you can see an example of this behavior.

**Example:**

This example uses the [React `ref` feature][].

[React `ref` feature]: https://facebook.github.io/react/docs/refs-and-the-dom.html

```js
class MyComponent extends Component {
  saySomething() {
    console.log('Hello, world!');
  }

  render() {
    // ...
  }
}

const MyGraphQLComponent = graphql(
  gql`{ ... }`,
  { withRef: true },
)(MyComponent);

class MyContainerComponent extends Component {
  render() {
    return (
      <MyGraphQLComponent
        ref={component => {
          assert(component.getWrappedInstance() instanceof MyComponent);
          // We can call methods on the component class instance.
          component.saySomething();
        }}
      />
    );
  }
}
```

<h3 id="graphql-config-alias">`config.alias`</h3>

By default the display name for React Apollo components is `Apollo(${WrappedComponent.displayName})`. This is a pattern used by most React libraries that make use of higher order components. However, it may get a little confusing when you are using more than one higher order component and you look at the [React Devtools][].

[React Devtools]: https://camo.githubusercontent.com/42385f70ef638c48310ce01a675ceceb4d4b84a9/68747470733a2f2f64337676366c703535716a6171632e636c6f756466726f6e742e6e65742f6974656d732f30543361333532443366325330423049314e31662f53637265656e25323053686f74253230323031372d30312d3132253230617425323031362e33372e30302e706e673f582d436c6f75644170702d56697369746f722d49643d626536623231313261633434616130636135386432623562616265373336323626763d3236623964363434

To configure the name of your higher order component wrapper, you may use the `config.alias` property. So for example, if you set `config.alias` to `'withCurrentUser'` your wrapper component display name would be `withCurrentUser(${WrappedComponent.displayName})` instead of `Apollo(${WrappedComponent.displayName})`.

**Example:**

This example uses the [`compose`](#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`{ ... }`, { alias: 'withCurrentUser' }),
  graphql(gql`{ ... }`, { alias: 'withList' }),
)(MyComponent);
```

<h2 id="compose" title="compose(...)">`compose(...enhancers)(component)`</h2>

```js
import { compose } from 'react-apollo';
```

For utility purposes, `react-apollo` exports a `compose` function. Using this function you may cleanly use several component enhancers at once. Including multiple [`graphql()`](#graphql), [`withApollo()`](#withApollo), or [Redux `connect()`][] enhancers. This should clean up your code when you use multiple enhancers. [Redux][] also exports a `compose` function, and so does [Recompose][] so you may choose to use the function from whichever library feels most appropriate.

Important to note is that `compose()` executes the last enhancer _first_, working its way backwards through the list of enhancers. To illustrate, calling three functions like  `funcC(funcB(funcA(component)))` is equivalent to calling `compose()` like `compose(funcC, funcB, funcA)(component)`. For more information, see the [Lodash `flowRight()`] docs (as `compose` is just an alias for `flowRight`).

[Redux `connect()`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options
[Redux]: http://redux.js.org/
[Recompose]: https://github.com/acdlite/recompose
[Lodash `flowRight()`]: https://lodash.com/docs/4.17.4#flowRight

**Example:**

```js
export default compose(
  withApollo,
  graphql(`query { ... }`),
  graphql(`mutation { ... }`),
  connect(...),
)(MyComponent);
```

<h2 id="withApollo">`withApollo(component)`</h2>

```js
import { withApollo } from 'react-apollo';
```

A simple enhancer which provides direct access to your [`ApolloClient`][] instance. This is useful if you want to do custom logic with Apollo. Such as calling one-off queries. By calling this function with the component you want to enhance, `withApollo()` will create a new component which passes in an instance of [`ApolloClient`][] as a `client` prop.

If you are wondering when to use `withApollo()` and when to use [`graphql()`](#graphql) the answer is that most of the time you will want to use [`graphql()`](#graphql). [`graphql()`](#graphql) provides many of the advanced features you need to work with your GraphQL data. You should only use `withApollo()` if you want the GraphQL client without any of the other features.

This will only be able to provide access to your client if there is an [`<ApolloProvider/>`](#ApolloProvider) component higher up in your tree to actually provide the client.

[`ApolloClient`]: #ApolloClient

**Example:**

```js
export default withApollo(MyComponent);

function MyComponent({ client }) {
  console.log(client);
}
```
