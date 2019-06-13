---
title: Mutations
description: Learn how to update data with Mutation components
---

Now that we've learned how to fetch data with Apollo Client, what happens when we need to update that data? In this guide, you'll discover how to build Mutation components in order to send updates to your GraphQL server. You'll also learn how to update the Apollo cache after a mutation occurs and how to handle errors when things go wrong.

This page assumes some familiarity with building GraphQL mutations. If you'd like a refresher, we recommend [reading this guide](http://graphql.org/learn/queries/#mutations).

The following examples assume that you've already set up Apollo Client and have wrapped your React app in an `ApolloProvider` component. Read our [getting started](/essentials/get-started/) guide if you need help with either of those steps. Let's dive in!

> If you'd like to follow along with the examples, open up our [starter project](https://codesandbox.io/s/znl94y0vp) on CodeSandbox, and our sample GraphQL server on [this CodeSandBox](https://codesandbox.io/s/plp0mopxq). You can view the completed version of the app [here](https://codesandbox.io/s/v3mn68xxvy).

## The Mutation component

The `Mutation` component is what you'll use to trigger mutations from your UI. To create a `Mutation` component, just pass a GraphQL mutation string wrapped with the `gql` function to `this.props.mutation` and provide a function to `this.props.children` that tells React what to render. The `Mutation` component is an example of a React component that uses the [render prop](https://reactjs.org/docs/render-props.html) pattern. React will call the render prop function you provide with a mutate function and an object with your mutation result containing loading, error, called, and data properties. Let's look at an example:

```jsx
import gql from "graphql-tag";
import { Mutation } from "react-apollo";

const ADD_TODO = gql`
  mutation AddTodo($type: String!) {
    addTodo(type: $type) {
      id
      type
    }
  }
`;

const AddTodo = () => {
  let input;

  return (
    <Mutation mutation={ADD_TODO}>
      {(addTodo, { data }) => (
        <div>
          <form
            onSubmit={e => {
              e.preventDefault();
              addTodo({ variables: { type: input.value } });
              input.value = "";
            }}
          >
            <input
              ref={node => {
                input = node;
              }}
            />
            <button type="submit">Add Todo</button>
          </form>
        </div>
      )}
    </Mutation>
  );
};
```

First, create your GraphQL mutation, wrap it in `gql`, and pass it to the `mutation` prop on the `Mutation` component. The `Mutation` component also requires a function as a child (also called the render prop function). The first argument of the render prop function is the mutate function, which you call to tell Apollo Client that you'd like to trigger a mutation. The mutate function optionally takes `variables`, `optimisticResponse`, `refetchQueries`, and `update`; however, you can also pass in those values as props to the `Mutation` component. In the example, notice how we use the mutate function (called `addTodo`) to submit the form with our variables.

The second argument to the render prop function is an object with your mutation result on the `data` property, as well as booleans for `loading` and if the mutate function was `called`, in addition to `error`. If you'd like to ignore the result of the mutation, pass `ignoreResults` as a prop to the mutation component.

If you're following along with the example on CodeSandbox, you probably noticed that the UI reflecting the list of todos did not update with our newly created todo when you submitted the form. This is because the todos query in the Apollo cache does not know about our newly created todo. In the next section, we'll learn when and how to update the Apollo cache after a mutation.

## Updating the cache

Sometimes when you perform a mutation, your GraphQL server and your Apollo cache become out of sync. This happens when the update you're performing depends on data that is already in the cache; for example, deleting and adding items to a list. We need a way to tell Apollo Client to update the query for the list of items. This is where the `update` function comes in! `update` functions aren't required to update the cache for all mutations, but our `addTodo` mutation is an example of where it comes in handy.

The update function is called with the Apollo cache as the first argument. The cache has several utility functions such as `cache.readQuery` and `cache.writeQuery` that allow you to read and write queries to the cache with GraphQL as if it were a server.
There are other cache methods, such as `cache.readFragment`, `cache.writeFragment`, and `cache.writeData`, which you can learn about in our detailed [caching guide](/advanced/caching/) if you're curious.

**Note**: The `update` function receives `cache` rather than `client` as its first parameter. This `cache` is typically an instance of `InMemoryCache`, as supplied to the `ApolloClient` constructor when the client was created. In case of the `update` function, when you call `cache.writeQuery`, the update internally calls `broadcastQueries`, so queries listening to the changes will update. However, this behavior of broadcasting changes after `cache.writeQuery` happens only with the `update` function. Anywhere else, `cache.writeQuery` would just write to the cache, and the changes would not be immediately broadcast to the view layer. To avoid this confusion, prefer `client.writeQuery` when writing to cache.

The second argument to the update function is an object with a data property containing your mutation result. If you specify an [optimistic response](/features/optimistic-ui/), your update function will be called twice: once with your optimistic result, and another time with your actual result. You can use your mutation result to update the cache with `cache.writeQuery`.

Now that we've learned about the update function, let's implement one for the `Mutation` component we just built!

```jsx
const GET_TODOS = gql`
  query GetTodos {
    todos
  }
`;

const AddTodo = () => {
  let input;

  return (
    <Mutation
      mutation={ADD_TODO}
      update={(cache, { data: { addTodo } }) => {
        const { todos } = cache.readQuery({ query: GET_TODOS });
        cache.writeQuery({
          query: GET_TODOS,
          data: { todos: todos.concat([addTodo]) },
        });
      }}
    >
      {addTodo => (
        <div>
          <form
            onSubmit={e => {
              e.preventDefault();
              addTodo({ variables: { type: input.value } });
              input.value = "";
            }}
          >
            <input
              ref={node => {
                input = node;
              }}
            />
            <button type="submit">Add Todo</button>
          </form>
        </div>
      )}
    </Mutation>
  );
};
```

You can pass the `update` function as a prop to `Mutation` or as an option to the mutate function (`addTodo` in this example). Since we need to update the query that displays a list of todos, first we read the data from the cache with `cache.readQuery`. Then, we concatenate our new todo from our mutation with the list of existing todos and write the query back to the cache with `cache.writeQuery`. Now that we've specified an update function, our UI will update reactively with the new todo once it comes back from the server.

Not every mutation requires an update function. If you're updating a single item, you usually don't need an update function as long as you return the item's `id` and the property you updated. While this may seem like magic, this is actually a benefit of Apollo's normalized cache, which splits out each object with an `id` into its own entity in the cache. Let's look at an example:

```jsx
const UPDATE_TODO = gql`
  mutation UpdateTodo($id: String!, $type: String!) {
    updateTodo(id: $id, type: $type) {
      id
      type
    }
  }
`;

const Todos = () => (
  <Query query={GET_TODOS}>
    {({ loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error :(</p>;

      return data.todos.map(({ id, type }) => {
        let input;

        return (
          <Mutation mutation={UPDATE_TODO} key={id}>
            {updateTodo => (
              <div>
                <p>{type}</p>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    updateTodo({ variables: { id, type: input.value } });

                    input.value = "";
                  }}
                >
                  <input
                    ref={node => {
                      input = node;
                    }}
                  />
                  <button type="submit">Update Todo</button>
                </form>
              </div>
            )}
          </Mutation>
        );
      });
    }}
  </Query>
);
```

If you try updating a todo, you'll notice that the UI updates immediately. Even though we don't plan on using the mutation return result in our UI, we still need to return the `id` and the property we updated in order for our UI to update reactively. Here, we don't need to specify an update function since the todos query will automatically reconstruct the query result with the updated todo's entry in the cache. If you'd like to dive deeper into the Apollo cache's normalization strategy, check out our advanced [caching guide](/advanced/caching/).

## Loading and error state

How do we know that our mutation has completed? What happens when your mutation doesn't complete successfully? We need a way to track loading and error state. Luckily, the Mutation component allows you to do just that. Let's look at the `Todos` component from the previous example:

```jsx
const Todos = () => (
  <Query query={GET_TODOS}>
    {({ loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error :(</p>;

      return data.todos.map(({ id, type }) => {
        let input;

        return (
          <Mutation mutation={UPDATE_TODO} key={id}>
            {(updateTodo, { loading, error }) => (
              <div>
                <p>{type}</p>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    updateTodo({ variables: { id, type: input.value } });

                    input.value = "";
                  }}
                >
                  <input
                    ref={node => {
                      input = node;
                    }}
                  />
                  <button type="submit">Update Todo</button>
                </form>
                {loading && <p>Loading...</p>}
                {error && <p>Error :( Please try again</p>}
              </div>
            )}
          </Mutation>
        );
      });
    }}
  </Query>
```

In the render prop function, we can destructure `loading` and `error` properties off the mutation result in order to track the state of our mutation in our UI. The `Mutation` component also has `onCompleted` and `onError` props in case you would like to provide callbacks instead. Additionally, the mutation result object also has a `called` boolean that tracks whether or not the mutate function has been called.

## Mutation API overview

If you're looking for an overview of all the props `Mutation` accepts and its render prop function, look no further! Most `Mutation` components will not need all of these configuration options, but it's useful to know that they exist. If you'd like to learn about the `Mutation` component API in more detail with usage examples, visit our [reference guide](/api/react-apollo/).

### Props

The Mutation component accepts the following props. Only `mutation` and `children` are **required**.

<dl>
  <dt>`mutation`: DocumentNode</dt>
  <dd>A GraphQL mutation document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (mutate: Function, result: MutationResult) => React.ReactNode</dt>
  <dd>A function that allows you to trigger a mutation from your UI. **Required**</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your mutation needs to execute</dd>
  <dt>`update`: (cache: DataProxy, mutationResult: FetchResult)</dt>
  <dd>A function used to update the cache after a mutation occurs</dd>
  <dt>`ignoreResults`: boolean</dt>
  <dd>If true, the `data` property on the render prop function will not update with the mutation result.</dd>
  <dt>`optimisticResponse`: Object</dt>
  <dd>Provide a [mutation response](/features/optimistic-ui/) before the result comes back from the server</dd>
  <dt>`refetchQueries`: (mutationResult: FetchResult) => Array<{ query: DocumentNode, variables?: TVariables} | string></dt>
  <dd>A function that allows you to specify which queries you want to refetch after a mutation has occurred</dd>
  <dt>`awaitRefetchQueries`: boolean</dt>
  <dd>Queries refetched as part of `refetchQueries` are handled asynchronously, and are not waited on before the mutation is completed (resolved). Setting this to `true` will make sure refetched queries are completed before the mutation is considered done. `false` by default.</dd>
  <dt>`onCompleted`: (data: TData) => void</dt>
  <dd>A callback executed once your mutation successfully completes</dd>
  <dt>`onError`: (error: ApolloError) => void</dt>
  <dd>A callback executed in the event of an error</dd>
  <dt>`context`: Record&lt;string, any&gt;</dt>
  <dd>Shared context between your Mutation component and your network interface (Apollo Link). Useful for setting headers from props or sending information to the `request` function of Apollo Boost.</dd>
</dl>

### Render prop function

The render prop function that you pass to the `children` prop of `Mutation` is called with the `mutate` function and an object with the mutation result. The `mutate` function is how you trigger the mutation from your UI. The object contains your mutation result, plus loading and error state.

**Mutate function:**

<dl>
  <dt>`mutate`: (options?: MutationOptions) => Promise&lt;FetchResult&gt;</dt>
  <dd>A function to trigger a mutation from your UI. You can optionally pass `variables`, `optimisticResponse`, `refetchQueries`, and `update` in as options, which will override any props passed to the `Mutation` component. The function returns a promise that fulfills with your mutation result.</dd>
</dl>

**Mutation result:**

<dl>
  <dt>`data`: TData</dt>
  <dd>The data returned from your mutation. It can be undefined if `ignoreResults` is true.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean indicating whether your mutation is in flight</dd>
  <dt>`error`: ApolloError</dt>
  <dd>Any errors returned from the mutation</dd>
  <dt>`called`: boolean</dt>
  <dd>A boolean indicating if the mutate function has been called</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>Your `ApolloClient` instance. Useful for invoking cache methods outside the context of the update function, such as `client.writeData` and `client.readQuery`.</dd>
</dl>

## Next steps

Learning how to build `Mutation` components to update your data is an important part of developing applications with Apollo Client. Now that you're well-versed in updating data, why not try executing client-side mutations with `apollo-link-state`? Here are some resources we think will help you level up your skills:

- [Optimistic UI](/features/optimistic-ui/): Learn how to improve perceived performance by returning an optimistic response before your mutation result comes back from the server.
- [Local state](/essentials/local-state/): Manage your local state with Apollo by executing client-side mutations with `apollo-link-state`.
- [Caching in Apollo](/advanced/caching/): Dive deep into the Apollo cache and how it's normalized in our advanced guide on caching. Understanding the cache is helpful when writing your mutation's `update` function!
- [Mutation component video by Sara Vieira](https://youtu.be/2SYa0F50Mb4): If you need a refresher or learn best by watching videos, check out this tutorial on `Mutation` components by Sara!
