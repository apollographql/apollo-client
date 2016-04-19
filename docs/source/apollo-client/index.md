---
title: Client overview
order: 101
description: Basic information on getting started with and using the Apollo Client.
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
- `reduxRootKey: string` (Optional, `apollo` by default) The key under which Apollo data will be stored in the Redux store. [Read more about integrating with Redux](customization.html#redux). If you aren't integrating with an existing Redux store, don't worry about this.

Here's how you would instantiate a default client that points to `/graphql`:

```js
// In ES2015 or TypeScript
import ApolloClient from 'apollo-client';

const client = new ApolloClient();
```

If you're not using ES2015, you can also load it with `require`:

```js
// In plain JavaScript
var ApolloClient = require('apollo-client').default;
```

The rest of the code snippets will use ES2015 import syntax.

<h3 id="createNetworkInterface" title="createNetworkInterface">createNetworkInterface(url, options)</h3>

Create a new HTTP network interface that points to a GraphQL server at a specific URI.

- `url: string` The URL of the remote server, for example `https://example.com/graphql`.
- `options: FetchOptions` (Optional) Options that are passed through to `fetch` XXX link to docs

Here's how you would instantiate a new client with a custom endpoint URL:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

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

<h3 id="forceFetch">query diffing and forceFetch</h3>

The Apollo Client doesn't just directly send your GraphQL queries to the server. It does a lot of pre-and-post processing of the data. One of the main things it does is _query diffing_, which means comparing a query you're about to fetch with the data the client fetched previously, and sending a new query that fetches only the necessary data.

For example, let's say you do two queries, one after the other:

```
// First query fetched
{
  todoList(id: 5) {
    title
    createdAt
    tasks {
      name
      completed
    }
  }
}

// Second query, after the user clicks a button
{
  todoList(id: 5) {
    title
    createdAt
    tasks {
      name
      completed
    }
  }
  user(id: 8) {
    name
    username
  }
}
```

The Apollo Client is smart enough to realize that it already has the `todoList` data for the second query, and sends only the `user` part:

```
// Actual second query sent
{
  user(id: 8) {
    name
    username
  }
}
```

You can take advantage of this feature to reduce the amount of data your app is loading, without putting in any extra work. For example, if someone navigates to a different page of your app, then comes back immediately, if you try to load the same query again the Apollo Client will just use the existing data. This is the default behavior.

We are always going to be improving the efficiency of the query diffing algorithm. Right now, it just does basic operations, but in the future it will be able to fetch single missing objects, and diff deeply nested queries. Follow along on the GitHub repository to find out when these features are coming.

<h4 id="forceFetch">Using forceFetch</h4>

Of course, you don't always want to use the existing data in the store - sometimes you want to get the new data directly from the server even though you already have it on the client. In this case, you should pass the `forceFetch` option to `query` or `watchQuery`, as documented below.

<h3 id="query" title="ApolloClient#query">ApolloClient#query(options)</h3>

Run a GraphQL query and return a promise that resolves to a `GraphQLResult`.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `false`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.

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

Run a GraphQL query and return a QueryObservable that is updated as the query result in the store changes.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `false`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.
- `returnPartialData: boolean` (Optional, default is `false`) If false, wait until the query has finished the initial load from the server to return any data. If true, return any data we might happen to already have in the store immediately. If you pass true for this option, your UI should be ready to deal with the possibility that it will get a partial result at first.

<h4 id="QueryObservable" title="QueryObservable">QueryObservable</h4>

This is the object you get when you call `watchQuery`. It has just one method, `subscribe`, to which you can pass a `QueryObserver` object:

- `subscribe(observer: QueryObserver)` Pass an observer object which gets called when there is new data. Returns a `QuerySubscription` object which you can use to unsubscribe or refetch.

<h4 id="QueryObserver" title="QueryObserver">interface QueryObserver</h4>

The object you pass into `QueryObservable#subscribe`. Includes optional callbacks to receive results:

- `next(result: GraphQLResult)` Called when there is a new result for the query.
- `error(error: Error)` Called when there is a network error for the query.

<h4 id="QuerySubscription" title="QuerySubscription">QuerySubscription</h4>

The object returned from `QueryObservable#subscribe`. Includes two methods:

- `refetch()` Refetch this query from the server. Think of it like a refresh button.
- `unsubscribe()` Notify the client to no longer care about this query. After this is called, none of the callbacks on the observer will be fired anymore. It's very important to call this when you are done with the query, because that is what lets the client know that it can clean up the data associated with this subscription. The view integrations will do this for you.

#### Code sample

All of the concepts above seem a bit complicated, but it's not hard to use in practice. Here's how you could run a query and then watch the result:

```js
const queryObservable = client.watchQuery({
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

const subscription = queryObservable.subscribe({
  next: (graphQLResult) => {
    const { errors, data } = graphQLResult;

    if (data) {
      console.log('got data', data);
    }

    if (errors) {
      console.log('got some GraphQL execution errors', errors);
    }
  },
  error: (error) => {
    console.log('there was an error sending the query', error);
  }
});

// Refetch the query if we want an updated result
subscription.refetch();

// Call when we're done watching this query
subscription.unsubscribe();
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
