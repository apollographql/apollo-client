---
title: "graphql: Container"
---

<h2 id="graphql" title="graphql(...)">`graphql(query, [config])(component)`</h2>

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

Alternatively, you can also use the `graphql()` function as a [decorator][] on your React class component.

[decorator]: https://github.com/wycats/javascript-decorators

If so your code may look like this:

```js
@graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)
export default class TodoApp extends Component {
  render() {
    const { data: { todos } } = this.props;
    return (
      <ul>
        {todos.map(({ id, text }) => (
          <li key={id}>{text}</li>
        ))}
      </ul>
    );
  }
}
```

The `graphql()` function will only be able to provide access to your GraphQL data if there is a [`<ApolloProvider/>`](#ApolloProvider) component higher up in your tree to provide an [`ApolloClient`][] instance that will be used to fetch your data.

[`ApolloClient`]: ../core/apollo-client-api.html#apollo-client

The behavior of your component enhanced with the `graphql()` function will be different depending on if your GraphQL operation is a [query](#queries), a [mutation](#mutations), or a [subscription](#subscriptions). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object.

<h2 id="graphql-config">`config`</h2>

The `config` object is the second argument you pass into the `graphql()` function, after your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

<h3 id="graphql-config.options">`config.options`</h3>

`config.options` is an object or a function that allows you to define the specific behavior your component should use in handling your GraphQL data.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql()`. There are options specific to [queries](#graphql-query-options) and [mutations](#graphql-mutation-options).

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

<h3 id="graphql-config.props">`config.props`</h3>

The `config.props` property allows you to define a map function that takes your props including the props added by the `graphql()` function ([`props.data`](#graphql-query-data) for queries and [`props.mutate`](#graphql-mutation-mutate) for mutations) and allows you to compute a new props object that will be provided to the component that `graphql()` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose][] providing the same benefits without the need for another library.

[`mapProps` from Recompose]: https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

Another benefit of `config.props` is that it also allows you to decouple your pure UI components from your GraphQL and Apollo concerns. You can write your pure UI components in one file and then keep the logic required for them to interact with the store in a completely different place in your project. You can accomplish this by your pure UI components only asking for the props needed to render and `config.props` can contain the logic to provide exactly the props your pure component needs from the data provided by your GraphQL API.

**Example:**

This example uses [`props.data.fetchMore`](#graphql-query-data.fetchMore).

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

<h3 id="graphql-config.skip">`config.skip`</h3>

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

<h3 id="graphql-config.name">`config.name`</h3>

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

<h3 id="graphql-config.withRef">`config.withRef`</h3>

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

<h3 id="graphql-config.alias">`config.alias`</h3>

By default the display name for React Apollo components is `Apollo(${WrappedComponent.displayName})`. This is a pattern used by most React libraries that make use of higher order components. However, it may get a little confusing when you are using more then one higher order components and you look at the [React Devtools][].

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

An important note is that `compose()` executes the last enhancer _first_ and works its way backwards through the list of enhancers. To illustrate calling three functions like this: `funcC(funcB(funcA(component)))` is equivalent to calling `compose()` like this: `compose(funcC, funcB, funcA)(component)`. If this does not make sense to you consider using [`flowRight()` from Lodash][] which otherwise has the same behavior.

[Redux `connect()`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options
[Redux]: http://redux.js.org/
[Recompose]: https://github.com/acdlite/recompose
[`flowRight()` from Lodash]: https://lodash.com/docs/4.17.4#flowRight

**Example:**

```js
export default compose(
  withApollo,
  graphql(`query { ... }`),
  graphql(`mutation { ... }`),
  connect(...),
)(MyComponent);
```
