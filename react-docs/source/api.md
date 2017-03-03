---
title: API Documentation
---

<h2 id="graphql">`graphql(query, config)(component)`</h2>

The `graphql` function is the most important thing exported by `react-apollo`. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql` function creates an “enhancer” function which when called with a component the enhancer function will create a new component with reactive GraphQL capabilities. This follows the React [higher-order component][] pattern which is also used by [`react-redux`’s `connect`][] function.

[higher-order component]: https://facebook.github.io/react/docs/higher-order-components.html
[`react-redux`’s `connect`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options

The `graphql` function may be used like this:

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

You may also be interested in using the `graphql` function as a [decorator][] on your React class component.

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

In this guide, we won't use the decorator syntax to make the code more familiar, but you can always use it if you prefer.

The configuration options that your `graphql` function accepts will be different depending on if your GraphQL operation is a [query](#queries) or a [mutation](#mutations). Go to the appropriate API documentation for more information about available options.

<h3 id="queries">Queries</h3>

An example component using a query with the `graphql` function:

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

There are two important objects associated with query components. The [`data` prop](#graphql-query-data), and the [`config` object](#graphql-query-config). Make sure to check out the recipes to see how everything fits together!

```js
class MyComponent extends Component {
  render() {
    const { data } = this.props; // <- The `data` prop.
  }
}

export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

<h3 id="graphql-query-data">`props.data`</h3>

The higher-order component created when using `graphql` will feed a `data` prop into your component. Like so:

```js
render() {
  const { data } = this.props; // <- The `data` prop.
}
```

The `data` prop contains the data fetched from your query in addition to some other useful information and functions to control the lifecycle of your GraphQL-connected component. So for example, if we had a query that looked like:

```graphql
{
  viewer { name }
  todos { text }
}
```

Your `data` prop would contain that data:

```js
render() {
  const { data } = this.props;

  console.log(data.viewer); // <- The data returned by your query for `viewer`.
  console.log(data.todos); // <- The data returned by your query for `todos`.
}
```

The `data` prop has some other useful properties which are all documented below. These properties can be accessed directly from `data`. For example, `data.loading` or `data.error`. These properties are documented below.

<h3 id="graphql-query-data.loading">`props.data.loading`</h3>

A boolean representing whether or not a query request is currently in flight for this component. This means that a query request has been sent using your network interface, and we have not yet gotten a response back. Use this property to render a loading component.

However, just because `data.loading` is true it does not mean that you won’t have data. For instance, if you already have `data.todos`, but you want to get the latest todos from your API `data.loading` might be true, but you will still have the todos from your previous request.

<h3 id="graphql-query-data.error">`props.data.error`</h3>

If an error occurred then this property will be an instance of [`ApolloError`][]. If you do not handle this error you will get a warning in your console that says something like: `"Unhandled (in react-apollo) Error: ..."`.

[`ApolloError`]: /core/apollo-client-api.html#ApolloError

<h3 id="graphql-query-data.variables">`props.data.variables`</h3>

The variables that Apollo used to fetch data from your GraphQL endpoint. This property is helpful if you want to render some information based off of the variables that were used to make a request against your server.

<h3 id="graphql-query-data.fetchMore">`props.data.fetchMore(options)`</h3>

The `data.fetchMore` function allows you to do pagination with your query component. To learn more about pagination with `data.fetchMore`, be sure to read the [pagination](pagination.html) recipe which contains helpful illustrations on how you can do pagination with React Apollo.

The `data.fetchMore` function takes a single `options` object argument. The `options` argument may take the following properties:

- `[query]`: This is an optional GraphQL document created with the `gql` GraphQL tag. If you specify a `query` then that query will be fetched when you call `data.fetchMore`. If you do not specify a `query`, then the query from your `graphql` HOC will be used.
- `[variables]`: The optional variables you may provide that will be used with either the `query` option or the query from your `graphql` HOC (depending on whether or not you specified a `query`).
- `updateQuery(previousResult, { fetchMoreResult, queryVariables })`: This is the required function you define that will actually update your paginated list. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql` function. The second argument is an object with two properties, `fetchMoreResult` and `queryVariables`. `fetchMoreResult` is the data returned by the new fetch that used the `query` and `variables` options from `data.fetchMore`. `queryVariables` are the variables that were used when fetching more data. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql` function. See an example of this below, and also make sure to read the [pagination](pagination.html) recipe which has a full example.

**Example:**

```js
data.fetchMore({
  updateQuery: (previousResult, { fetchMoreResult }) => {
    return {
      ...previousResult,
      // Add the new feed data to the end of the old feed data.
      feed: [...previousResult.feed, ...fetchMoreResult.data.feed],
    },
  },
});
```

<h3 id="graphql-query-config">`config`</h3>

<h3 id="mutations">Mutations</h3>

<!-- TODO: ### Subscriptions? -->

<h2 id="ApolloProvider">`<ApolloProvider client={client} />`</h2>

<h2 id="withApollo">`withApollo(component)`</h2>

<h2 id="server">Server</h2>

<h2 id="getDataFromTree">`getDataFromTree(TODO)`</h2>

<h2 id="renderToStringWithData">`renderToStringWithData(TODO)`</h2>
