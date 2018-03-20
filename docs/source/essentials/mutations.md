---
title: Mutations
description: Learn how to update data with Mutation components
---

<h2 id="basic">The Mutation component</h2>

<h2 id="data">Sending a mutation</h2>

<h2 id="errors">Handling errors</h2>

<h2 id="update">Updating the cache</h2>

<h2 id="api">Mutation API overview</h2>

If you're looking for an overview of all the props `Mutation` accepts and its render prop function, look no further! Most `Mutation` components will not need all of these configuration options, but it's useful to know that they exist. If you'd like to learn about the `Mutation` component API in more detail with usage examples, visit our [reference guide](../api/react-apollo).

<h3 id="props">Props</h3>

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
  <dd>Provide a [mutation response](../features/optimistic-ui) before the result comes back from the server</dd>
  <dt>`refetchQueries`: (mutationResult: FetchResult) => Array<{ query: DocumentNode, variables?: TVariables}></dt>
  <dd>A function that allows you to specify which queries you want to refetch after a mutation has occurred</dd>
  <dt>`onCompleted`: (data: TData) => void</dt>
  <dd>A callback executed once your mutation successfully completes</dd>
  <dt>`onError`: (error: ApolloError) => void</dt>
  <dd>A callback executed in the event of an error</dd>
  <dt>`context`: Record<string, any></dt>
  <dd>Shared context between your Mutation component and your network interface (Apollo Link). Useful for setting headers from props or sending information to the `request` function of Apollo Boost.</dd>
</dl>

<h3 id="render-prop">Render prop function</h3>

The render prop function that you pass to the `children` prop of `Mutation` is called with the `mutate` function and an object with the mutation result. The `mutate` function is how you trigger the mutation from your UI. The object contains your mutation result, plus loading and error state.

**Mutate function:**

<dl>
  <dt>`mutate`: (options?: MutationOptions) => Promise<FetchResult></dt>
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
</dl>

<h2 id="next-steps">Next steps</h2>

Learning how to build `Mutation` components to update your data is an important part of developing applications with Apollo Client. Now that you're well-versed in updating data, why not try executing client-side mutations with `apollo-link-state`? Here are some resources we think will help you level up your skills:

- [Mutation component video by Sara Vieira](https://youtu.be/2SYa0F50Mb4): If you need a refresher or learn best by watching videos, check out this tutorial on `Mutation` components by Sara!
- [Optimistic UI](../features/optimistic-ui): Learn how to improve perceived performance by returning an optimistic response before your mutation result comes back from the server.
- [Local state](../features/local-state): Manage your local state with Apollo by executing client-side mutations with `apollo-link-state`.
- [Caching in Apollo](../advanced/caching): Dive deep into the Apollo cache and how it's normalized in our advanced guide on caching. Understanding the cache is helpful when writing your mutation's `update` function!
