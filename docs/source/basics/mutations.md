---
title: Mutations
---

In addition to fetching data using queries, Apollo also helps you handle GraphQL mutations. In GraphQL, mutations are identical to queries in syntax, the only difference being that you use the keyword `mutation` instead of `query` to indicate that the root fields on this query are going to be performing writes to the backend.

```js
mutation {
  submitRepository(repoFullName: "apollographql/apollo-client") {
    id
    repoName
  }
}
```

GraphQL mutations represent two things in one query string:

1. The mutation field name with arguments, `submitRepository`, which represents the actual operation to be done on the server.
2. The fields you want back from the result of the mutation to update the client, in this case `{ id, repoName }`.

The above mutation will submit a new GitHub repository to GitHunt, saving an entry to the database. The result might be:

```
{
  "data": {
    "submitRepository": {
      "id": "123",
      "repoName": "apollographql/apollo-client"
    }
  }
}
```

When we use mutations in Apollo, the result is typically integrated into the cache automatically [based on the id of the result](../advanced/caching.html#normalization), which in turn updates the UI automatically, so we often don't need to explicitly handle the results. In order for the client to correctly do this, we need to ensure we select the necessary fields in the result. One good strategy can be to simply ask for any fields that might have been affected by the mutation. Alternatively, you can use [fragments](../advanced/fragments.html) to share the fields between a query and a mutation that updates that query.

<h2 id="basics">Basic mutations</h2>

Using `graphql` with mutations makes it easy to bind actions to your components. Unlike queries, which provide a complicated object with lots of metadata and methods, mutations provide only a simple function to the wrapped component, in a prop called `mutate`.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class NewEntry extends Component { ... }

const submitRepository = gql`
  mutation SubmitRepository {
    submitRepository(repoFullName: "apollographql/apollo-client") {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

The component created above will receive a prop called `mutate` which is a function that returns a promise of the mutation result.

<h2 id="calling-mutations">Calling mutations</h2>

Most mutations will require arguments in the form of query variables, and you may wish to also provide other options as well. [See the complete set of mutation options in the API docs.](#graphql-mutation-options)

The simplest option is to directly pass options to the default `mutate` prop when you call it in the wrapped component:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class NewEntry extends Component {
  onClick() {
    this.props.mutate({
      variables: { repoFullName: 'apollographql/apollo-client' }
    })
      .then(({ data }) => {
        console.log('got data', data);
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });
  }

  render() {
    return <div onClick={this.onClick.bind(this)}>Click me</div>;
  }
}

const submitRepository = gql`
  mutation SubmitRepository($repoFullName: String!) {
    submitRepository(repoFullName: $repoFullName) {
      createdAt
    }
  }
`;

const NewEntryWithData = graphql(submitRepository)(NewEntry);
```

<h3 id="custom-arguments">Custom arguments</h3>

While the above approach with the default prop works just fine, typically you'd want to keep the concern of formatting the mutation options out of your presentational component. The best way to do this is to use the [`props`](setup.html#graphql-config-props) config to wrap the mutation in a function that accepts exactly the arguments it needs:

```js
const NewEntryWithData = graphql(submitRepository, {
  props: ({ mutate }) => ({
    submit: (repoFullName) => mutate({ variables: { repoFullName } }),
  }),
})(NewEntry);
```

Here's that in context with a component, which can now be much simpler because it just needs to pass one argument:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

const NewEntry = ({ submit }) => (
  <div onClick={() => submit('apollographql/apollo-client')}>
    Click me
  </div>
);

const submitRepository = gql`...`; // Same query as above

const NewEntryWithData = graphql(submitRepository, {
  props: ({ mutate }) => ({
    submit: (repoFullName) => mutate({ variables: { repoFullName } }),
  }),
})(NewEntry);
```

Note that, in general, you don't need to use the results from the mutation callback directly. Instead you should usually rely on Apollo's id-based cache updating to take care of it for you. If that doesn't cover your needs, there are [several different options for updating the store after a mutation](../advanced/caching.html#after-mutations). That way, you can keep your UI components as stateless and declarative as possible.

<h2 id="multiple-mutations">Multiple mutations</h2>

If you need more than one mutation on a component, you can make a graphql container for each:

```js
const ComponentWithMutations =
  graphql(submitNewUser, { name: 'newUserMutation' })(
    graphql(submitRepository, { name: 'newRepositoryMutation' })(Component)
  )
```

Make sure to use the [`name` option on the `graphql()` container](./setup.html#graphql-config-name) to name the provided prop, so that the two containers don't both try to name their function `mutate`.

If you want a better syntax for the above, consider using [`compose`](./setup.html#compose):

```js
import { compose } from 'react-apollo';

const ComponentWithMutations = compose(
  graphql(submitNewUser, { name: 'newUserMutation' }),
  graphql(submitRepository, { name: 'newRepositoryMutation' })
)(Component);
```

This does the exact same thing as the previous snippet, but with a nicer syntax that flattens things out.

If you need to run multiple mutations in one query you can do that like so:
```
const replaceUser = gql`
  mutation replaceUser($userToAdd: User!, $userToRemove: User! ) {
    submitNewUser(newUser: $userToAdd){
      userId
    }
    deleteUser(userToRemove: $userToRemove){
      userId
    }
  }
`;

const ReplaceCurrentUser = graphql(replaceUser, {
  props: ({ mutate, userToAdd, userToRemove }) => {
    // do stuff
    return mutate({ variables: { userToAdd, userToRemove } })
  },
})(Component);
```
These mutations will be run in series, so the first one is guaranteed to succeed before the second one will start. This is useful if you have multiple mutations that need to be run at the same time and that are dependant on each other. You can use [mutation batching](../advanced/network-layer.html#MutationBatching) if the order doesn't matter and your server supports batching.

<h2 id="optimistic-ui">Optimistic UI</h2>

Sometimes your client code can easily predict the result of a successful mutation even before the server responds with the result. For instance, in GitHunt, when a user comments on a repository, we want to show the new comment in the UI immediately, without waiting on the latency of a round trip to the server, giving the user a faster UI experience. This is what we call [Optimistic UI](../features/optimistic-ui.html). This is possible with Apollo if the client can predict an *optimistic response* for the mutation.

All you need to do is specify the `optimisticResponse` option. This "fake result" will be used to update active queries immediately, in the same way that the server's mutation response would have done. The optimistic patches are stored in a separate place in the cache, so once the actual mutation returns, the relevant optimistic update is automatically thrown away and replaced with the real result.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class CommentPage extends Component { ... }

const submitComment = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`;

const CommentPageWithData = graphql(submitComment, {
  props: ({ ownProps, mutate }) => ({
    submit: ({ repoFullName, commentContent }) => mutate({
      variables: { repoFullName, commentContent },

      optimisticResponse: {
        __typename: 'Mutation',
        submitComment: {
          __typename: 'Comment',
          // Note that we can access the props of the container at `ownProps` if we
          // need that information to compute the optimistic response
          postedBy: ownProps.currentUser,
          createdAt: +new Date,
          content: commentContent,
        },
      },
    }),
  }),
})(CommentPage);
```

For the example above, it is easy to construct an optimistic response, since we know the shape of the new comment and can approximately predict the created data. The optimistic response doesn't have to be exactly correct because it will always will be replaced with the real result from the server, but it should be close enough to make users feel like there is no delay.

<h2 id="mutation-results">Designing mutation results</h2>

When people talk about GraphQL, they often focus on the data fetching side of things, because that's where GraphQL brings the most value. Mutations can be pretty elegant if done well, but the principles of designing good mutations, and especially good mutation result types, are not yet well-understood in the open source community. So when you are working with mutations it might often feel like you need to make a lot of application-specific decisions.

In GraphQL, mutations can return any type, and that type can be queried just like a regular GraphQL query. So the question is - what type should a particular mutation return?

In most cases, the data available from a mutation result should be the server developer's best guess of the data a client would need to understand what happened on the server. For example, a mutation that creates a new comment on a blog post might return the comment itself. A mutation that reorders an array might need to return the whole array.


<h2 id="store-updates">Updating the cache after a mutation</h2>

Being able to read and write to the Apollo cache from anywhere in your application gives you a lot of power over your data. However, there is one place where we most often want to update our cached data: after a mutation. As such, Apollo Client has optimized the experience for updating your cache with the read and write methods after a mutation with the `update` function. Let us say that we have the following GraphQL mutation:

```graphql
mutation TodoCreateMutation($text: String!) {
  createTodo(text: $text) {
    id
    text
    completed
  }
}
```

We may also have the following GraphQL query:

```graphql
query TodoAppQuery {
  todos {
    id
    text
    completed
  }
}
```

At the end of our mutation we want our query to include the new todo like we had sent our `TodoAppQuery` a second time after the mutation finished without actually sending the query. To do this we can use the `update` function provided as an option of the `client.mutate` method. To update your cache with the mutation just write code that looks like:

```js
// We assume that the GraphQL operations `TodoCreateMutation` and
// `TodoAppQuery` have already been defined using the `gql` tag.

const text = 'Hello, world!';

client.mutate({
  mutation: TodoCreateMutation,
  variables: {
    text,
  },
  update: (proxy, { data: { createTodo } }) => {
    // Read the data from our cache for this query.
    const data = proxy.readQuery({ query: TodoAppQuery });

    // Add our todo from the mutation to the end.
    data.todos.push(createTodo);

    // Write our data back to the cache.
    proxy.writeQuery({ query: TodoAppQuery, data });
  },
});
```

<h2 title="API Reference" id="api">API Reference</h2>

<h3 id="graphql-mutation-mutate">`props.mutate`</h3>

The higher order component created when you pass a mutation to `graphql()` will provide your component with a single prop named `mutate`. Unlike the `data` prop which you get when you pass a query to `graphql()`, `mutate` is a function.

The `mutate` function will actually execute your mutation using the network interface therefore mutating your data. The `mutate` function will also then update your cache in ways you define.

To learn more about how mutations work, be sure to check out the [mutations usage documentation](mutations.html).

The `mutate` function accepts the same options that [`config.options` for mutations](#graphql-mutation-options) accepts, so make sure to read through the documentation for that to know what you can pass into the `mutate` function.

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


<h3 id="graphql-mutation-options">`config.options`</h3>

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are availble when your operation is a mutation. To see what other options are available for different operations, see the generic documentation for [`config.options`](#graphql-config-options).

The properties accepted in this options object may also be accepted by the [`props.mutate`](#graphql-mutation-mutate) function. Any options passed into the `mutate` function will take precedence over the options defined in the `config` object.

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

To learn more about the benefits of optimistic data and how to use it be sure to read the recipe on [Optimistic UI](../features/optimistic-ui.html).

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

For more information on updating your cache after a mutation with the `options.update` function make sure to read the [Apollo Client technical documentation on the subject](../features/caching.html#updating-the-cache-after-a-mutation).

[`DataProxy`]: ../advanced/caching.html#direct
[`writeQuery`]: ../advanced/caching.html#writequery-and-writefragment
[`writeFragment`]: ../advanced/caching.html#writequery-and-writefragment
[`readQuery`]: ../advanced/caching.html#readquery
[`readFragment`]: ../advanced/caching.html#readfragment

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

`options.refetchQueries` is either an array of strings or objects, or a function which takes the result of the mutation and returns an array of strings or objects.

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
```js
export default graphql(gql`mutation { ... }`, {
  options: {
    refetchQueries: (mutationResult) => [
      'CommentList',
      'PostList',
    ],
  },
})(MyComponent);
```



<h3 id="graphql-mutation-options-updateQueries">`options.updateQueries`</h3>

**Note: We recommend using [update](#graphql-mutation-options-update) instead of `updateQueries`. `updateQueries` will be removed in the next version of Apollo Client**

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

To learn more about `options.updateQueries` read our usage documentation on [controlling the store with `updateQueries`](../api/react-apollo.html#graphql-mutation-options-updateQueries).

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
