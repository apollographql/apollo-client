---
title: Using Apollo Client directly
description: Learn how to access Apollo Client from the ApolloConsumer component
---

While `Query` and `Mutation` components cover most of our data fetching and updating needs, there are some situations where it's easier to access the client directly. Prefetching data and delaying fetching are two use cases well-suited for firing off a query directly from Apollo Client instead of building a `Query` component. Additionally, writing a simple local mutation directly from Apollo Client instead of a `Mutation` component can simplify `apollo-link-state` code. Let's learn how the `ApolloConsumer` component can help us execute these features.

<h2 id="apollo-consumer">The ApolloConsumer component</h2>

To access the client directly, create an `ApolloConsumer` component and provide a render prop function as its child. The render prop function will be called with your `ApolloClient` instance as its only argument. You can think of the `ApolloConsumer` component as similar to the `Consumer` component from the [new React context API](https://github.com/reactjs/rfcs/blob/master/text/0002-new-version-of-context.md).

Here's the `ApolloConsumer` component in action:

```jsx
import React from 'react';
import { ApolloConsumer } from "react-apollo";

const WithApolloClient = () => (
  <ApolloConsumer>
    {client => "We have access to the client!" /* do stuff here */}
  </ApolloConsumer>
);
```

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

<h2 id="manual-query">Manually firing a query</h2>

When React mounts a `Query` component, Apollo Client automatically fires off your query. What if you wanted to delay firing your query until the user performs an action, such as clicking on a button? For this scenario, we want to use an `ApolloConsumer` component and directly call `client.query()` instead.

```jsx
import React, { Component } from 'react';
import { ApolloConsumer } from 'react-apollo';

class DelayedQuery extends Component {
  state = { dog: null };

  onDogFetched = dog => this.setState(() => ({ dog }));

  render() {
    return (
      <ApolloConsumer>
        {client => (
          <div>
            {this.state.dog && <img src={this.state.dog.displayImage} />}
            <button
              onClick={async () => {
                const { data } = await client.query({
                  query: GET_DOG_PHOTO,
                  variables: { breed: "bulldog" }
                });
                this.onDogFetched(data.dog);
              }}
            >
              Click me!
            </button>
          </div>
        )}
      </ApolloConsumer>
    );
  }
}
```

Fetching this way is quite verbose, so we recommend trying to use a `Query` component if at all possible!

<h2 id="prefetching">Prefetching data</h2>

Prefetching data is a great way to improve perceived performance. We can accomplish this in only a few lines of code by calling `client.query` whenever the user hovers over a link. Let's see this in action in the `Feed` component in our example app [Pupstagram](https://codesandbox.io/s/r5qp83z0yq).

```jsx
const Feed = () => (
  <View style={styles.container}>
    <Header />
    <Query query={GET_DOGS}>
      {({ loading, error, data, client }) => {
        if (loading) return <Fetching />;
        if (error) return <Error />;

        return (
          <DogList
            data={data.dogs}
            renderRow={(type, data) => (
              <Link
                to={{
                  pathname: `/${data.breed}/${data.id}`,
                  state: { id: data.id }
                }}
                onMouseOver={() =>
                  client.query({
                    query: GET_DOG,
                    variables: { breed: data.breed }
                  })
                }
                style={{ textDecoration: "none" }}
              >
                <Dog {...data} url={data.displayImage} />
              </Link>
            )}
          />
        );
      }}
    </Query>
  </View>
);
```

All we have to do is access the client in the render prop function and call `client.query` when the user hovers over the link. Once the user clicks on the link, the data will already be available in the Apollo cache, so the user won't see a loading state.
