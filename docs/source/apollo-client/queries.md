---
title: Queries
order: 102
description: How to run queries to fetch data with Apollo Client.
---

The primary function of the Apollo Client is running GraphQL queries to retrieve data from the server. There are two ways to get data: running a query once and getting a single result, and running a query then watching the result via a callback.

<h2 id="query-vs-watchquery">`query` vs. `watchQuery`</h2>

If you want to fetch some data to perform a one-time operation, then `query` is the right way to go. If you are using the query result to render some UI, it's advantageous to use `watchQuery`, since that will automatically update whenever any of the following things happen:

1. A different query or mutation updates the data in the store
2. A mutation performs an optimistic update
3. Data is re-fetched because of a reactive update

This means that using `watchQuery` will keep your UI consistent, so that every query being displayed on the screen shows the exact same data for the same objects.

Currently `watchQuery` allows reactivity via the optional `pollInterval` argument. In the future, `watchQuery` will also have more options for reactivity, like connecting to a source of invalidations for reactive re-fetching, or accepting pushed data from the server for low-latency updates. Using it now will allow you to easily switch those options on when they become available.

<h2 id="caching">Query result caching</h2>

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

<h3 id="forceFetch">Using forceFetch</h3>

Of course, you don't always want to use the existing data in the store - sometimes you want to get the new data directly from the server even though you already have it on the client. In this case, you should pass the `forceFetch` option to `query` or `watchQuery`, as documented below.

<h2 id="query" title="ApolloClient#query">ApolloClient#query(options)</h2>

Run a GraphQL query and return a promise that resolves to a [`GraphQLResult`](./network.html#GraphQLResult), or throws an [`ApolloError`](#ApolloError).

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `false`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.
- `fragments: FragmentDefinition[]` An array of fragment definitions, as returned by `createFragment`. [Learn more on the fragments page.](fragments.html)

Here's how you would run a single query and get the result:

```js
import ApolloClient from 'apollo-client';

// Polyfill fetch into the namespace if required.
// import fetch from 'isomorphic-fetch';

const client = new ApolloClient();

client.query({
  query: gql`
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
}).then(({ data }) => {
  console.log('got data', data);
}).catch((error) => {
  console.log('there was an error sending the query', error);
});
```

<h2 id="watchQuery" title="ApolloClient#watchQuery">ApolloClient#watchQuery(options)</h2>

Run a GraphQL query and return a QueryObservable that is updated as the query result in the store changes, or throws an [`ApolloError`](#ApolloError).

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `false`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.
- `returnPartialData: boolean` (Optional, default is `false`) If false, wait until the query has finished the initial load from the server to return any data. If true, return any data we might happen to already have in the store immediately. If you pass true for this option, your UI should be ready to deal with the possibility that it will get a partial result at first.
- `pollInterval: number` (Optional, default is no polling). Setting a polling interval (in ms) will refetch your query from the server (forceFetch) on the interval rate provided by the key.
- `fragments: FragmentDefinition[]` An array of fragment definitions, as returned by `createFragment`. [Learn more on the fragments page.](fragments.html)


<h3 id="QueryObservable" title="QueryObservable">QueryObservable</h3>

This is the object you get when you call `watchQuery`. The most important method is `subscribe`, which lets you get query results. There are also some Apollo-Client-specific methods to refetch and poll query results:

- `subscribe(observer: QueryObserver)` Pass an observer object which gets called when there is new data. Returns a `QuerySubscription` object which you can use to unsubscribe or refetch.
- `refetch(variables: Object)` Refetch this query from the server. Think of it like a refresh button. This can take an object of new variables
- `fetchMore(options)` update results of the query by fetching a new query and combining the results. See [pagination](./pagination.html) for more info.
- `stopPolling()` Stop an actively polling query.
- `startPolling(pollInterval: number)` Start polling a query
- `updateQuery(transformFn: function)` Updates results of the query in store, by transforming its previous result. The transform function takes the previous result and options containing information about the original query. The function must return a new value of the query result. 

<h3 id="QueryObserver" title="QueryObserver">interface QueryObserver</h3>

The object you pass into `QueryObservable#subscribe`. It should include optional callbacks to get results or errors from the query:

- `next(result: GraphQLResult)` Called when there is a new result for the query.
- `error(error: ApolloError)` Called when there is any error for the query. Read more [in the `ApolloError` section below](queries.html#ApolloError).

<h3 id="QuerySubscription" title="QuerySubscription">QuerySubscription</h3>

The object returned from `QueryObservable#subscribe`. Includes just one method:

- `unsubscribe()` Notify the client to no longer care about this query. After this is called, none of the callbacks on the observer will be fired anymore. It's very important to call this when you are done with the query, because that is what lets the client know that it can clean up the data associated with this subscription. The view integrations will do this for you.

#### Code sample

All of the concepts above seem a bit complicated, but it's not hard to use in practice. Here's how you could run a query and then watch the result:

```js
const queryObservable = client.watchQuery({
  query: gql`
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
  pollInterval: 50,
});

const subscription = queryObservable.subscribe({
  next: ({ data }) => {
    console.log('got data', data);
  },
  error: (error) => {
    console.log('there was an error sending the query', error);
  }
});

// Refetch the query if we want an updated result
queryObservable.refetch();

// Stop polling this query
queryObservable.stopPolling();

// Start polling this query
queryObservable.startPolling(100);

// Call when we're done watching this query
subscription.unsubscribe();
```

<h2 id="ApolloError">ApolloError</h2>

Apollo uses the custom error type `ApolloError` as the standard way to communicate GraphQL-related errors to your application.

`ApolloError` extends the standard Javascript `Error` type, meaning that you can treat it as a standard `Error` and expect it to work correctly, but it also includes some extra fields that will help you write code that handles different types of errors. As a rule of thumb, you should not use the error message string to determine the type of error that has occurred. Instead, you should use the information that `ApolloError` provides:

- `graphQLErrors: GraphQLError[]`: Array containing the errors returned by the server on a specific GraphQL query. When Apollo Client sends a query to the GraphQL server, these errors are contained within the errors key of the response returned by the server.
- `networkError: Error`: Error that has occurred in fetching the query from the server (e.g. Apollo Client is unable to reach the server).
- `message: string`: The error message that describes what went wrong. If there were multiple errors, this error message includes the error messages (separated by newlines) for each element in `graphQLErrors` and the `networkError`, if they are defined.
