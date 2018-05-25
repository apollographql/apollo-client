---
title: Queries
description: Learn how to fetch data with Query components
---

Fetching data in a simple, predictable way is one of the core features of Apollo Client. In this guide, you'll learn how to build Query components in order to fetch GraphQL data and attach the result to your UI. You'll also learn how Apollo Client simplifies your data management code by tracking error and loading states for you.

This page assumes some familiarity with building GraphQL queries. If you'd like a refresher, we recommend [reading this guide](http://graphql.org/learn/queries/) and practicing [running queries in GraphiQL](../features/developer-tooling.html#features). Since Apollo Client queries are just standard GraphQL, you can be sure that any query that successfully runs in GraphiQL will also run in an Apollo Query component.

The following examples assume that you've already set up Apollo Client and have wrapped your React app in an `ApolloProvider` component. Read our [getting started](./get-started.html) guide if you need help with either of those steps.

> If you'd like to follow along with the examples, open up our [starter project](https://codesandbox.io/s/j2ly83749w) on CodeSandbox and our sample GraphQL server on [Launchpad](https://launchpad.graphql.com/nx9zvp49q7). You can view the completed version of the app [here](https://codesandbox.io/s/n3jykqpxwm).

<h2 id="basic">The Query component</h2>

The `Query` component is one of the most important building blocks of your Apollo application. To create a `Query` component, just pass a GraphQL query string wrapped with the `gql` function to `this.props.query` and provide a function to `this.props.children` that tells React what to render. The `Query` component is an example of a React component that uses the [render prop](https://reactjs.org/docs/render-props.html) pattern. React will call the render prop function you provide with an object from Apollo Client containing loading, error, and data properties that you can use to render your UI. Let's look at an example:

First, let's create our GraphQL query. Remember to wrap your query string in the `gql` function in order to parse it into a query document. Once we have our GraphQL query, let's attach it to our `Query` component by passing it to the `query` prop.

We also need to provide a function as a child to our `Query` component that will tell React what we want to render. We can use the `loading`, `error`, and `data` properties that the `Query` component provides for us in order to intelligently render different UI depending on the state of our query. Let's see what this looks like!

```jsx
import gql from "graphql-tag";
import { Query } from "react-apollo";

const GET_DOGS = gql`
  {
    dogs {
      id
      breed
    }
  }
`;

const Dogs = ({ onDogSelected }) => (
  <Query query={GET_DOGS}>
    {({ loading, error, data }) => {
      if (loading) return "Loading...";
      if (error) return `Error! ${error.message}`;

      return (
        <select name="dog" onChange={onDogSelected}>
          {data.dogs.map(dog => (
            <option key={dog.id} value={dog.breed}>
              {dog.breed}
            </option>
          ))}
        </select>
      );
    }}
  </Query>
);
```

If you render `Dogs` within your `App` component, you'll first see a loading state and then a form with a list of dog breeds once Apollo Client receives the data from the server. When the form value changes, we're going to send the value to a parent component via `this.props.onDogSelected`, which will eventually pass the value to a `DogPhoto` component.

In the next step, we're going to hook our form up to a more complex query with variables by building a `DogPhoto` component.

<h2 id="data">Receiving data</h2>

You've already seen a preview of how to work with the result of your query in the render prop function. Let's dive deeper into what's happening behind the scenes with Apollo Client when we fetch data from a `Query` component.

1. When the `Query` component mounts, Apollo Client creates an observable for our query. Our component subscribes to the result of the query via the Apollo Client cache.
2. First, we try to load the query result from the Apollo cache. If it's not in there, we send the request to the server.
3. Once the data comes back, we normalize it and store it in the Apollo cache. Since the `Query` component subscribes to the result, it updates with the data reactively.

To see Apollo Client's caching in action, let's build our `DogPhoto` component. `DogPhoto` accepts a prop called `breed` that reflects the current value of our form from the `Dogs` component above.

```jsx
const GET_DOG_PHOTO = gql`
  query dog($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

const DogPhoto = ({ breed }) => (
  <Query query={GET_DOG_PHOTO} variables={{ breed }}>
    {({ loading, error, data }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return (
        <img src={data.dog.displayImage} style={{ height: 100, width: 100 }} />
      );
    }}
  </Query>
);
```

You'll notice there is a new configuration option on our `Query` component. The prop `variables` is an object containing the variables we want to pass to our GraphQL query. In this case, we want to pass the breed from the form into our query.

Try selecting "bulldog" from the list to see its photo show up. Then, switch to another breed and switch back to "bulldog". You'll notice that the bulldog photo loads instantaneously the second time around. This is the Apollo cache at work!

Next, let's learn some techniques for ensuring our data is fresh, such as polling and refetching.

<h2 id="refetching">Polling and refetching</h2>

It's awesome that Apollo Client caches your data for you, but what should we do when we want fresh data? Two solutions are polling and refetching.

Polling can help us achieve near real-time data by causing the query to refetch on a specified interval. To implement polling, simply pass a `pollInterval` prop to the `Query` component with the interval in ms. If you pass in 0, the query will not poll. You can also implement dynamic polling by using the `startPolling` and `stopPolling` functions on the result object passed to the render prop function.

```jsx
const DogPhoto = ({ breed }) => (
  <Query
    query={GET_DOG_PHOTO}
    variables={{ breed }}
    skip={!breed}
    pollInterval={500}
  >
    {({ loading, error, data, startPolling, stopPolling }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return (
        <img src={data.dog.displayImage} style={{ height: 100, width: 100 }} />
      );
    }}
  </Query>
);
```

By setting the `pollInterval` to 500, you should see a new dog image every .5 seconds. Polling is an excellent way to achieve near-realtime data without the complexity of setting up GraphQL subscriptions.

What if you want to reload the query in response to a user action instead of an interval? That's where the `refetch` function comes in! Here, we're adding a button to our `DogPhoto` component that will trigger a refetch when clicked. `refetch` takes variables, but if we don't pass in new variables, it will use the same ones from our previous query.

```jsx
const DogPhoto = ({ breed }) => (
  <Query
    query={GET_DOG_PHOTO}
    variables={{ breed }}
    skip={!breed}
  >
    {({ loading, error, data, refetch }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return (
        <div>
          <img
            src={data.dog.displayImage}
            style={{ height: 100, width: 100 }}
          />
          <button onClick={() => refetch()}>Refetch!</button>
        </div>
      );
    }}
  </Query>
);
```

If you click the button, you'll notice that our UI updates with a new dog photo. Refetching is an excellent way to guarantee fresh data, but it introduces some added complexity with loading state. In the next section, you'll learn strategies to handle complex loading and error state.

<h2 id="loading">Loading and error state</h2>

We've already seen how Apollo Client exposes our query's loading and error state in the render prop function. These properties are helpful for when the query initially loads, but what happens to our loading state when we're refetching or polling?

Let's go back to our refetching example from the previous section. If you click on the refetch button, you'll see that the component doesn't re-render until the new data arrives. What if we want to indicate to the user that we're refetching the photo?

Luckily, Apollo Client provides fine-grained information about the status of our query via the `networkStatus` property on the result object in the render prop function. We also need to set the prop `notifyOnNetworkStatusChange` to true so our query component re-renders while a refetch is in flight.

```jsx
const DogPhoto = ({ breed }) => (
  <Query
    query={GET_DOG_PHOTO}
    variables={{ breed }}
    skip={!breed}
    notifyOnNetworkStatusChange
  >
    {({ loading, error, data, refetch, networkStatus }) => {
      if (networkStatus === 4) return "Refetching!";
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return (
        <div>
          <img
            src={data.dog.displayImage}
            style={{ height: 100, width: 100 }}
          />
          <button onClick={() => refetch()}>Refetch!</button>
        </div>
      );
    }}
  </Query>
);
```

The `networkStatus` property is an enum with number values from 1-8 representing a different loading state. 4 corresponds to a refetch, but there are also numbers for polling and pagination. For a full list of all the possible loading states, check out the [reference guide](../api/react-apollo.html#graphql-query-data-networkStatus).

While not as complex as loading state, responding to errors in your component is also customizable via the `errorPolicy` prop on the `Query` component. The default value for `errorPolicy` is "none" in which we treat all GraphQL errors as runtime errors. In the event of an error, Apollo Client will discard any data that came back with the request and set the `error` property in the render prop function to true. If you'd like to show any partial data along with any error information, set the `errorPolicy` to "all".

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

> If you'd like to view a complete version of the app we just built, you can check out the CodeSandbox [here](https://codesandbox.io/s/n3jykqpxwm).

<h2 id="api">Query API overview</h2>

If you're looking for an overview of all the props `Query` accepts and its render prop function, look no further! Most `Query` components will not need all of these configuration options, but it's useful to know that they exist. If you'd like to learn about the `Query` component API in more detail with usage examples, visit our [reference guide](../api/react-apollo.html).

<h3 id="props">Props</h3>

The Query component accepts the following props. Only `query` and `children` are **required**.

<dl>
  <dt>`query`: DocumentNode</dt>
  <dd>A GraphQL query document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (result: QueryResult) => React.ReactNode</dt>
  <dd>A function returning the UI you want to render based on your query result. **Required**</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your query needs to execute</dd>
  <dt>`pollInterval`: number</dt>
  <dd>Specifies the interval in ms at which you want your component to poll for data. Defaults to 0 (no polling).</dd>
  <dt>`notifyOnNetworkStatusChange`: boolean</dt>
  <dd>Whether updates to the network status or network error should re-render your component. Defaults to false.</dd>
  <dt>`fetchPolicy`: FetchPolicy</dt>
  <dd>How you want your component to interact with the Apollo cache. Defaults to "cache-first".</dd>
  <dt>`errorPolicy`: ErrorPolicy</dt>
  <dd>How you want your component to handle network and GraphQL errors. Defaults to "none", which means we treat GraphQL errors as runtime errors.</dd>
  <dt>`ssr`: boolean</dt>
  <dd>Pass in false to skip your query during server-side rendering.</dd>
  <dt>`displayName`: string</dt>
  <dd>The name of your component to be displayed in React DevTools. Defaults to 'Query'.</dd>
  <dt>`delay`: boolean</dt>
  <dd>If `delay` is true, the `Query` component will not fetch the query on mount although its children will still render. Use `delay` with `load` in the render prop function to manually fire the query.</dd>
  <dt>`context`: Record<string, any></dt>
  <dd>Shared context between your Query component and your network interface (Apollo Link). Useful for setting headers from props or sending information to the `request` function of Apollo Boost.</dd>
</dl>

<h3 id="render-prop">Render prop function</h3>

The render prop function that you pass to the `children` prop of `Query` is called with an object (`QueryResult`) that has the following properties. This object contains your query result, plus some helpful functions for refetching, dynamic polling, and pagination.

<dl>
  <dt>`data`: TData</dt>
  <dd>An object containing the result of your GraphQL query. Defaults to an empty object.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean that indicates whether the request is in flight</dd>
  <dt>`error`: ApolloError</dt>
  <dd>A runtime error with `graphQLErrors` and `networkError` properties</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing the variables the query was called with</dd>
  <dt>`networkStatus`: NetworkStatus</dt>
  <dd>A number from 1-8 corresponding to the detailed state of your network request. Includes information about refetching and polling status. Used in conjunction with the `notifyOnNetworkStatusChange` prop.</dd>
  <dt>`refetch`: (variables?: TVariables) => Promise<ApolloQueryResult></dt>
  <dd>A function that allows you to refetch the query and optionally pass in new variables</dd>
  <dt>`fetchMore`: ({ query?: DocumentNode, variables?: TVariables, updateQuery: Function}) => Promise<ApolloQueryResult></dt>
  <dd>A function that enables [pagination](../features/pagination.html) for your query</dd>
  <dt>`load`: () => void</dt>
  <dd>A function to manually fetch the query instead of fetching when the component mounts. Use with the `delay` prop on the `Query` component. Useful for prefetching data</dd>
  <dt>`startPolling`: (interval: number) => void</dt>
  <dd>This function sets up an interval in ms and fetches the query each time the specified interval passes.</dd>
  <dt>`stopPolling`: () => void</dt>
  <dd>This function stops the query from polling.</dd>
  <dt>`subscribeToMore`: (options: { document: DocumentNode, variables?: TVariables, updateQuery?: Function, onError?: Function}) => () => void</dt>
  <dd>A function that sets up a [subscription](../advanced/subscriptions.html). `subscribeToMore` returns a function that you can use to unsubscribe.</dd>
  <dt>`updateQuery`: (previousResult: TData, options: { variables: TVariables }) => TData</dt>
  <dd>A function that allows you to update the query's result in the cache outside the context of a fetch, mutation, or subscription</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>Your `ApolloClient` instance. Useful for manually firing queries or writing data to the cache.</dd>
</dl>

<h2 id="next-steps">Next steps</h2>

Learning how to build `Query` components to fetch data is one of the most important skills to mastering development with Apollo Client. Now that you're a pro at fetching data, why not try building `Mutation` components to update your data? Here are some resources we think will help you level up your skills:

- [Mutations](./mutations.html): Learn how to update data with mutations and when you'll need to update the Apollo cache. For a full list of options, check out the API reference for `Mutation` components.
- [Local state management](./local-state.html): Learn how to query local data with `apollo-link-state`.
- [Pagination](../features/pagination.html): Building lists has never been easier thanks to Apollo Client's `fetchMore` function. Learn more in our pagination tutorial.
- [Query component video by Sara Vieira](https://youtu.be/YHJ2CaS0vpM): If you need a refresher or learn best by watching videos, check out this tutorial on `Query` components by Sara!
