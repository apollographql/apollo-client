# Queries

The primary function of the Apollo Client is running GraphQL queries to retrieve data from the server. There are two ways to get data: running a query once and getting a single result, and running a query then watching the result via a callback.

### Difference between `query` and `watchQuery`

If you want to fetch some data to perform a one-time operation, then `query` is the right way to go. If you are using the query result to render some UI, it's advantageous to use `watchQuery`, since that will automatically update whenever any of the following things happen:

1. A different query or mutation updates the data in the store
2. A mutation performs an optimistic update
3. Data is re-fetched because of a reactive update

This means that using `watchQuery` will keep your UI consistent, so that every query being displayed on the screen shows the exact same data for the same objects.

In the future, `watchQuery` will also have some extra options for reactivity, allowing you to set a polling interval, connect to a source of invalidations for reactive re-fetching, or accept pushed data from the server for low-latency updates. Using it now will allow you to easily switch those options on when they become available.

## API

### ApolloClient#query(options)

Run a GraphQL query and return a promise that resolves to a `GraphQLResult`.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `true`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.

### ApolloClient#watchQuery(options)

Run a GraphQL query and return a `WatchedQueryHandle` that is updated as the query result in the store changes.

- `query: string` A GraphQL query string to fetch.
- `variables: Object` The variables to pass along with the query.
- `forceFetch: boolean` (Optional, default is `true`) If true, send the query to the server directly without any pre-processing. If false, check if we have some of the data for the query on the client already, and send a minimized query to the server to refetch only the objects we don't have already.
- `returnPartialData: boolean` (Optional, default is `false`) If false, wait until the query has finished the initial load from the server to return any data. If true, return any data we might happen to already have in the store immediately. If you pass true for this option, your UI should be ready to deal with the possibility that it will get a partial result at first.

### WatchedQueryHandle

This is the object you get when you call `watchQuery`. It has some helpful properties and functions you can use to read data from your query and manipulate it:

- `onResult(callback)` Register a callback to be called whenever this query has new data.
- `stop()` Tell the client we are no longer interested in results for this query, and that it can be cleaned up. Any callbacks previously registered with `onResult` will no longer be called. Note that if you don't call this function when you're done with the query, it will never be cleaned up, which could result in a memory leak. Any view layer integration should make sure to call this when UI components that asked for data are unrendered.
- `isStopped(): boolean` Find out if this query has been stopped.
- XXX onError, isLoading, getResult, getError should be added

## Examples

Running a single query and getting the result:

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

Running a query and then watching the result:

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
