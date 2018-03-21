---
title: Local state management
description: Learn how to store your local data in Apollo Client
---

While `Query` and `Mutation` components cover most of our data fetching and updating needs, there are some situations where it's easier to access the client directly. Prefetching data and delaying fetching are two use cases well-suited for firing off a query directly from Apollo Client instead of building a `Query` component. Additionally, writing a simple local mutation directly from Apollo Client instead of a `Mutation` component can simplify `apollo-link-state` code. Let's learn how the `ApolloConsumer` component can help us execute these features.

With `ApolloConsumer`, your UI has full access to all of the methods on your `ApolloClient` instance. For a comprehensive list, check out our [API reference](../api/apollo-client) for Apollo Client.

<h2 id="client-prop">Access from Query and Mutation</h2>

You can also access your `ApolloClient` instance from the render prop function you pass to your `Query` and `Mutation` components. Here's a quick example:

```jsx
import React from 'react';
import { Query } from "react-apollo";
import gql from "graphql-tag";

const Articles = () => (
  <Query query={gql`
    {
      articles {
        id
      }
    }
  `}>
    {({ client, loading, data }) => {
      // do stuff with the client here
    }}
  </Query>
);
```

Now that we know how to access Apollo Client directly, let's look at some real-world examples.

<h2 id="local-data">Updating local data</h2>

Accessing the client directly is helpful for [updating local data](../features/local-state) in the Apollo cache with `apollo-link-state`. In this example, we're writing a single value to the cache using the `ApolloConsumer` component.

```jsx
import React from 'react';
import { ApolloConsumer } from 'react-apollo';

const SimpleMutation = () => (
  <ApolloConsumer>
    {(cache) => (
      <button onClick={() => cache.writeData({ data: { status: 'yo' }})}>Click me!</button>
    )}
  </ApolloConsumer>
)
```

It's important to note that this write does not depend on the data that's currently in the cache. For mutations where you need to query the cache first, like adding an item to a list, you should write a mutation and client-side resolvers instead of taking this approach.

If you're writing a component that performs a local mutation and also needs to subscribe to its result, just wrap it in a `Query` component and access the client in the render prop function.

```jsx
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

// make sure to set an initial value for status in defaults when you initialize link-state
const QueryThatSubscribesToMutation = () => (
  <Query query={gql`
    {
      status @client
    }
  `}>
    ({ data, client }) => (
      <div>
       <p>{data.status}</p>
       <button onClick={() => client.writeData({ data: { status: 'yo' }})}>Click me!</button>
      </div>
    )
  </Query>
)
```

With this approach, there are some tradeoffs. `cache.writeData` writes the data directly to the cache without creating a mutation or calling resolvers. If you write to the cache directly outside of the context of your client-side schema and resolvers, you won't gain the tooling benefits of client schema introspection for that write. That being said, we think this approach is generally fine for one-off local mutations that don't depend on the data that's currently in the cache.

