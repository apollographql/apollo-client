---
sidebar_title: "graphql: Mutations"
title: "API: graphql container with mutations"
---

> This article is specifically about using mutations with the `graphql()` higher order component. To see options that apply to all operations, see the [general graphql container API docs](/react/api-graphql.html).

The operation that you pass into your `graphql()` function decides how your component will behave. If you pass a mutation into your `graphql()` function then Apollo will set up a `mutate` function in your components props that you may call at any time.

Here is an example component that uses a mutation with the `graphql()` function:

```js
export default graphql(gql`
  mutation TodoCompleteMutation($id: ID!) {
    completeTodo(id: $id) {
      id
      text
      completed
    }
  }
`)(TodoCompleteButton);

function TodoCompleteButton({ todoID, mutate }) {
  return (
    <button onClick={() => mutate({ variables: { id: todoID } })}>
      Complete
    </button>
  );
}
```

For a more natural overview of mutations with the `graphql()` function be sure to read the [Mutations documentation article](mutations.html). For a technical overview of all the features supported by the `graphql()` function for mutations, continue on.

<h2 id="graphql-mutation-mutate">`props.mutate`</h2>

The higher order component created when you pass a mutation to `graphql()` will provide your component with a single prop named `mutate`. Unlike the `data` prop which you get when you pass a query to `graphql()`, `mutate` is a function.

The `mutate` function will actually execute your mutation using the network interface therefore mutating your data. The `mutate` function will also then update your cache in ways you define.

To learn more about how mutations work, be sure to check out the [mutations usage documentation](mutations.html).

The `mutate` function accepts the same options that [`config.options` for mutations](#graphql-mutation-options) accepts, so to make sure to read through the documentation for that to know what you can pass into the `mutate` function.

The reason the `mutate` function accepts the same options is that it will use the options from [`config.options`](#graphql-mutation-options) _by default_. When you pass an object into the `mutate` function you are just overriding what is already in [`config.options`](#graphql-mutation-options).

**Example:**

```js
function MyComponent({ mutate }) {
  return (
    <button onClick={() => {
      mutate({
        variables: { foo: 42 },
      });
    }}>
      Mutate
    </button>
  );
}

export default graphql(gql`mutation { ... }`)(MyComponent);
```

<h2 id="graphql-mutation-options">`config.options`</h2>

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are availble when your operation is a mutation. To see what other options are available for different operations, see the generic documentation for [`config.options`](#graphql-config-options).

The properties accepted in this options object may also be excepted by the [`props.mutate`](#graphql-mutation-mutate) function. Any options passed into the `mutate` function will take precedence over the options defined in the `config` object.

**Example:**

```js
export default graphql(gql`mutation { ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`mutation { ... }`, {
  options: (props) => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

```js
function MyComponent({ mutate }) {
  return (
    <button onClick={() => {
      mutate({
        // Options are component from `props` and component state here.
      });
    }}>
      Mutate
    </button>
  )
}

export default graphql(gql`mutation { ... }`)(MyComponent);
```

<h3 id="graphql-mutation-options-variables">`options.variables`</h3>

The variables which will be used to execute the mutation operation. These variables should correspond to the variables that your mutation definition accepts. If you define `config.options` as a function, or you pass variables into the [`props.mutate`](#graphql-mutation-mutate) function then you may compute your variables from props and component state.

**Example:**

```js
export default graphql(gql`
  mutation ($foo: String!, $bar: String!) {
    ...
  }
`, {
  options: (props) => ({
    variables: {
      foo: props.foo,
      bar: props.bar,
    },
  }),
})(MyComponent);
```

<h3 id="graphql-mutation-options-optimisticResponse">`options.optimisticResponse`</h3>

Often when you mutate data it is fairly easy to predict what the response of the mutation will be before asking your server. The optimistic response option allows you to make your mutations feel faster by simulating the result of your mutation in your UI before the mutation actually finishes.

To learn more about the benefits of optimistic data and how to use it be sure to read the recipe on [Optimistic UI](optimistic-ui.html).

This optimistic response will be used with [`options.update`](#graphql-mutation-options-update) and [`options.updateQueries`](#graphql-mutation-options-updateQueries) to apply an update to your cache which will be rolled back before applying the update from the actual response.

**Example:**

```js
function MyComponent({ newText, mutate }) {
  return (
    <button onClick={() => {
      mutate({
        variables: {
          text: newText,
        },
        // The optimistic response has all of the fields that are included in
        // the GraphQL mutation document below.
        optimisticResponse: {
          createTodo: {
            id: -1, // A temporary id. The server decides the real id.
            text: newText,
            completed: false,
          },
        },
      });
    }}>
      Add Todo
    </button>
  );
}

export default graphql(gql`
  mutation ($text: String!) {
    createTodo(text: $text) {
      id
      text
      completed
    }
  }
`)(MyComponent);
```

<h3 id="graphql-mutation-options-update">`options.update`</h3>

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.update` function.

`options.update` takes two arguments. The first is an instance of a [`DataProxy`][] object which has some methods which will allow you to interact with the data in your store. The second is the response from your mutation - either the optimistic response, or the actual response returned by your server.

In order to change the data in your store call methods on your [`DataProxy`][] instance like [`writeQuery`][] and [`writeFragment`][]. This will update your cache and reactively re-render any of your GraphQL components which are querying affected data.

To read the data from the store that you are changing, make sure to use methods on your [`DataProxy`][] like [`readQuery`][] and [`readFragment`][].

For more information on updating your cache after a mutation with the `options.update` function make sure to read the [Apollo Client technical documentation on the subject](../core/read-and-write.html#updating-the-cache-after-a-mutation).

[`DataProxy`]: ../core/apollo-client-api.html#DataProxy
[`writeQuery`]: ../core/apollo-client-api.html#DataProxy.writeQuery
[`writeFragment`]: ../core/apollo-client-api.html#DataProxy.writeFragment
[`readQuery`]: ../core/apollo-client-api.html#DataProxy.readQuery
[`readFragment`]: ../core/apollo-client-api.html#DataProxy.readFragment

**Example:**

```js
const query = gql`{ todos { ... } }`

export default graphql(gql`
  mutation ($text: String!) {
    createTodo(text: $text) { ... }
  }
`, {
  options: {
    update: (proxy, { data: { createTodo } }) => {
      const data = proxy.readQuery({ query });
      data.todos.push(createTodo);
      proxy.writeQuery({ query, data });
    },
  },
})(MyComponent);
```

<h3 id="graphql-mutation-options-refetchQueries">`options.refetchQueries`</h3>

Sometimes when you make a mutation you also want to update the data in your queries so that your users may see an up-to-date user interface. There are more fine-grained ways to update the data in your cache which include [`options.updateQueries`](#graphql-mutation-options-updateQueries), and [`options.update`](#graphql-mutation-options-update). However, you can update the data in your cache more reliably at the cost of efficiency by using `options.refetchQueries`.

`options.refetchQueries` will execute one or more queries using your network interface and will then normalize the results of those queries into your cache. Allowing you to potentially refetch queries you had fetched before, or fetch brand new queries.

`options.refetchQueries` is an array of either strings or objects.

If `options.refetchQueries` is an array of strings then Apollo Client will look for any queries with the same names as the provided strings and will refetch those queries with their current variables. So for example if you have a GraphQL query component with a query named `Comments` (the query may look like: `query Comments { ... }`), and you pass an array of strings containing `Comments` to `options.refetchQueries` then the `Comments` query will be re-executed and when it resolves the latest data will be reflected in your UI.

If `options.refetchQueries` is an array of objects then the objects must have two properties:

- `query`: Query is a required property that accepts a GraphQL query created with `graphql-tag`’s `gql` template string tag. It should contain a single GraphQL query operation that will be executed once the mutation has completed.
- `[variables]`: Is an optional object of variables that is required when `query` accepts some variables.

If an array of objects with this shape is specified then Apollo Client will refetch these queries with their variables.

**Example:**

```js
export default graphql(gql`mutation { ... }`, {
  options: {
    refetchQueries: [
      'CommentList',
      'PostList',
    ],
  },
})(MyComponent);
```

```js
import { COMMENT_LIST_QUERY } from '../components/CommentList';

export default graphql(gql`mutation { ... }`, {
  options: (props) => ({
    refetchQueries: [
      {
        query: COMMENT_LIST_QUERY,
      },
      {
        query: gql`
          query ($id: ID!) {
            post(id: $id) {
              commentCount
            }
          }
        `,
        variables: {
          id: props.postID,
        },
      },
    ],
  }),
})(MyComponent);
```

<h3 id="graphql-mutation-options-updateQueries">`options.updateQueries`</h3>

**Note: We recommend using [update](./#graphql-mutation-options-update) instead of `updateQueries`.**

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.updateQueries` function.

`options.updateQueries` takes an object where query names are the keys and reducer functions are the values. If you are familiar with Redux, defining your `options.updateQueries` reducers is very similar to defining your Redux reducers. The object looks something like this:

```js
{
  Comments: (previousData, { mutationResult, queryVariables }) => nextData,
}
```

Make sure that the key of your `options.updateQueries` object corresponds to an actual query that you have made somewhere else in your app. The query name will be the name you put after specifying the `query` operation type. So for example in the following query:

```graphql
query Comments {
  entry(id: 5) {
    comments {
      ...
    }
  }
}
```

The query name would be `Comments`. If you have not executed a GraphQL query with the name of `Comments` before somewhere in your application, then the reducer function will never be run by Apollo and the key/value pair in `options.updateQueries` will be ignored.

The first argument to the function you provide as the value for your object will be the previous data for your query. So if your key is `Comments` then the first argument will be the last data object that was returned for your `Comments` query, or the current object that is being rendered by any component using the `Comments` query.

The second argument to your function value will be an object with three properties:

- `mutationResult`: The `mutationResult` property will represent the result of your mutation after hitting the server. If you provided an [`options.optimisticResponse`](#graphql-mutation-options-optimisticResponse) then `mutationResult` may be that object.
- `queryVariables`: The last set of variables that the query was executed with. This is helpful because when you specify the query name it will only update the data in the store for your current variable set.
- `queryName`: This is the name of the query you are updating. It is the same name as the key you provided to `options.updateQueries`.

The return value of your `options.updateQueries` functions _must_ have the same shape as your first `previousData` argument. However, you _must not_ mutate the `previousData` object. Instead you must create a new object with your changes. Just like in a Redux reducer.

To learn more about `options.updateQueries` read our usage documentation on [controlling the store with `updateQueries`](cache-updates.html#updateQueries).

**Example:**

```js
export default graphql(gql`
  mutation ($text: String!) {
    submitComment(text: $text) { ... }
  }
`, {
  options: {
    updateQueries: {
      Comments: (previousData, { mutationResult }) => {
        const newComment = mutationResult.data.submitComment;
        // Note how we return a new copy of `previousData` instead of mutating
        // it. This is just like a Redux reducer!
        return {
          ...previousData,
          entry: {
            ...previousData.entry,
            comments: [newComment, ...previousData.entry.comments],
          },
        };
      },
    },
  },
})(MyComponent);
```
