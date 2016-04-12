---
title: Introduction
order: 101
description: These are Apollo Docs!!
---

The Apollo Client can easily be dropped into any JavaScript frontend where you want to use data from a GraphQL server.

## Installing

```txt
npm install apollo-client
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3. Move on to the next article to see how to import and initialize the client.

## Client

The Apollo Client class is the thing you import from this package, and should be instantiated to communicate with your server. You can instantiate as many clients as you want, but most apps will have exactly one of these. If you want to talk to multiple backends, the right place to do that is in your GraphQL server.

<h3 id="ApolloClient" title="ApolloClient">new ApolloClient(options)</h3>

Instantiate a new Apollo Client.

- `networkInterface: NetworkInterface` (Optional, defaults to an interface that points to `/graphql`) The network interface to use when sending GraphQL queries to the server.
- `XXX redux integration` (Optional, creates a new Redux store by default) A Redux store to in which to keep all state.

Here's how you would instantiate a default client that points to `/graphql`:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();
```

<h3 id="createNetworkInterface" title="createNetworkInterface">createNetworkInterface(url, options)</h3>

Create a new HTTP network interface that points to a GraphQL server at a specific URI.

- `url: string` The URL of the remote server, for example `https://example.com/graphql`.
- `options: FetchOptions` (Optional) Options that are passed through to `fetch` XXX link to docs

Here's how you would instantiate a new client with a custom endpoint URL:

```js
import ApolloClient from 'apollo-client';

const networkInterface = createNetworkInterface('https://example.com/graphql');

const client = new ApolloClient({
  networkInterface,
});
```

<h2 id="queries">Queries</h2>

The primary function of the Apollo Client is running GraphQL queries to retrieve data from the server. There are two ways to get data: running a query once and getting a single result, and running a query then watching the result via a callback.

<h3 id="query-vs-watchquery">`query` vs. `watchQuery`</h3>

If you want to fetch some data to perform a one-time operation, then `query` is the right way to go. If you are using the query result to render some UI, it's advantageous to use `watchQuery`, since that will automatically update whenever any of the following things happen:

1. A different query or mutation updates the data in the store
2. A mutation performs an optimistic update
3. Data is re-fetched because of a reactive update

This means that using `watchQuery` will keep your UI consistent, so that every query being displayed on the screen shows the exact same data for the same objects.

In the future, `watchQuery` will also have some extra options for reactivity, allowing you to set a polling interval, connect to a source of invalidations for reactive re-fetching, or accept pushed data from the server for low-latency updates. Using it now will allow you to easily switch those options on when they become available.

<h3 id="query" title="ApolloClient#query">ApolloClient#query(options)</h3>

Run a GraphQL query and return a promise that resolves to a `GraphQLResult`.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `true`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.

Here's how you would run a single query and get the result:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();

client.query({
  query: `
    query getCategory($categoryId: Int!) {
      category(id: $categoryId) {
        name
        color
      }
    }
  `,
  variables: {
    categoryId: 5,
  },
  forceFetch: false,
}).then((graphQLResult) => {
  const { errors, data } = graphQLResult;

  if (data) {
    console.log('got data', data);
  }

  if (errors) {
    console.log('got some GraphQL execution errors', errors);
  }
}).catch((error) => {
  console.log('there was an error sending the query', error);
});
```

<h3 id="watchQuery" title="ApolloClient#watchQuery">ApolloClient#watchQuery(options)</h3>

Run a GraphQL query and return a `WatchedQueryHandle` that is updated as the query result in the store changes.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `true`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.
- `returnPartialData: boolean` (Optional, default is `false`) If false, wait until the query has finished the initial load from the server to return any data. If true, return any data we might happen to already have in the store immediately. If you pass true for this option, your UI should be ready to deal with the possibility that it will get a partial result at first.

<h3 id="WatchedQueryHandle" title="WatchedQueryHandle">WatchedQueryHandle</h3>

This is the object you get when you call `watchQuery`. It has some helpful properties and functions you can use to read data from your query and manipulate it:

- `onResult(callback)` Register a callback to be called whenever this query has new data.
- `stop()` Tell the client we are no longer interested in results for this query, and that it can be cleaned up. Any callbacks previously registered with `onResult` will no longer be called. Note that if you don't call this function when you're done with the query, it will never be cleaned up, which could result in a memory leak. Any view layer integration should make sure to call this when UI components that asked for data are unrendered.
- `isStopped(): boolean` Find out if this query has been stopped.
- XXX onError, isLoading, getResult, getError should be added

Here's how you could run a query and then watch the result:

```js
const handle = client.watchQuery({
  query: `
    query getCategory($categoryId: Int!) {
      category(id: $categoryId) {
        name
        color
      }
    }
  `,
  variables: {
    categoryId: 5,
  },
  forceFetch: false,
  returnPartialData: true,
});

handle.onResult((graphQLResult) => {
  const { errors, data } = graphQLResult;

  if (data) {
    console.log('got data', data);
  }

  if (errors) {
    console.log('got some GraphQL execution errors', errors);
  }
});

// XXX onError

// Call when we're done watching this query
handle.stop();
```

## Mutations

In addition to fetching data using queries, the Apollo Client also handles GraphQL mutations. Current support for mutations is relatively basic, just letting you send a mutation and then incorporate the result into the store.

<h3 id="mutate" title="ApolloClient#mutate">ApolloClient#mutate(options)</h3>

Send a mutation to the server and get the result. The result is also incorporated into the store, updating any queries registered with `watchQuery` that are interested in the changed objects. Returns a promise that resolves to a GraphQLResult.

- `mutation: string` The mutation to send to the server.
- `variables: Object` The variables to send along with the mutation.

Here's how you would call a mutation and pass in arguments via variables:

```js
import ApolloClient from 'apollo-client';

const client = new ApolloClient();

client.mutate({
  mutation: `
    mutation postReply(
      $token: String!
      $topic_id: ID!
      $category_id: ID!
      $raw: String!
    ) {
      createPost(
        token: $token
        topic_id: $topic_id
        category: $category_id
        raw: $raw
      ) {
        id
        cooked
      }
    }
  `,
  variables: {
    token: 'asdf',
    topic_id: '123',
    category_id: '456',
    raw: 'This is the post text.',
  }
}).then((graphQLResult) => {
  const { errors, data } = graphQLResult;

  if (data) {
    console.log('got data', data);
  }

  if (errors) {
    console.log('got some GraphQL execution errors', errors);
  }
}).catch((error) => {
  console.log('there was an error sending the query', error);
});
```

Right now, this is a bit verbose because you have to list the names of the variables three times, but we hope to improve this in the future.
