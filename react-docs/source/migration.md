---
title: Migrating from 0.x to 1.0
sidebar_title: Migrating to 1.0
description: A short guide.
---

Here are the main breaking changes between the 0.x and 1.0 versions of Apollo Client.

<h2 id="fetchMore">fetchMore</h2>

The structure of `fetchMoreResult` has been changed. Previously `fetchMoreResult` used to contain `data` and `loading` fields, now `fetchMoreResult` is what `fetchMoreResult.data` used to be. This means your `updateQueries` function has to change as follows:

```js
updateQuery: (prev, { fetchMoreResult }) => {
  return Object.assign({}, prev, {
    // feed: [...prev.feed, ...fetchMoreResult.data.feed], // this is what it used to be
    feed: [...prev.feed, ...fetchMoreResult.feed], // this is what it has to be now.  
  });
},
```

<h2 id="fetchPolicy">fetchPolicy</h2>

The `forceFetch` and `noFetch` query options are no longer available. Instead, they have been replaced with a unified API called `fetchPolicy`. `fetchPolicy` accepts the following settings:

- `{ fetchPolicy: 'cache-first' }`: This is the default fetch policy that Apollo Client uses when no fetch policy is specified. First it will try to fulfill the query from the cache. Only if the cache lookup fails will a query be sent to the server.
- `{ fetchPolicy: 'cache-only' }`: With this option, Apollo Client will try to fulfill the query from the cache only. If not all data is available in the cache, an error will be thrown. This is equivalent to the former `noFetch`. 
- `{ fetchPolicy: 'network-only' }`: With this option, Apollo Client will bypass the cache and directly send the query to the server. This is equivalent to the former `forceFetch`.
- `{ fetchPolicy: 'cache-and-network' }`: With this option, Apollo Client will query the server, but return data from the cache while the server request is pending, and later update the result when the server response has come back. 

<h2 id="returnPartialData">returnPartialData</h2>

The `returnPartialData` query option has been removed in Apollo 1.0 because it could be hard to predict what data would be available if a query was run in this mode.

To replace the function of running one query with `returnPartialData`, it is recommended to run two separate queries:

1. A large query that asks for all the data you want to display in this view once it's loaded.
2. A small query that fetches only a subset of the larger query that you know is already cached. This query's data can then be displayed while the larger query is loading.

Here's an example:

```
const FullSomethingComponent => (props) => {
  if (props.data.loading) {
    return <PreviewSomethingComponent {...props} />
  }
}

const fullQuery = gql`{
  channel(name: "x") {
    name
    topic
    messages {
      text
    }
  }
}`;

const previewQuery = gql`{
  channel(name: "x") {
    name
    topic
  }
}`;

const PreviewSomethingComponent => (props) => {
  if (props.data.loading) {
    // Whoops, we don't have that data, even though it should be in the cache. Just show a loading component
    return (<Loading />);
  }
  
  // just render the channel name and topic, show loading spinner for messages, or something like that.
  return (<div> ... stuff here </div>);

}

const SomethingComponentWithData = graphql(fullQuery)(FullSomethingComponent);

const PreviewSomethingComponentWithData = graphql(previewQuery)(PreviewSomethingComponent);

```

<h2 id="resultTransformer">resultTransformer</h2>

This global option allowed applying a transform to Apollo Client before it returned query and mutation results. Because it was rarely used and complicated the logic inside Apollo Client, it has been removed. The recommended way to transform data is to apply the transform outside of Apollo Client.
In `react-apollo` this can be done inside the `props` option.


<h2 id="queryDeduplication">queryDeduplication</h2>

Query deduplication is a global option on Apollo Client ensures that if there are multiple identical queries, Apollo Client will only send one to the server. It does this by checking a new query against queries already in flight before sending it.

`queryDeduplication` is set to `true` by default. It can be turned off by passing `{queryDeduplication: false}` to the Apollo Client constructor.


<h2 id="notifyOnNetworkStatusChange">notifyOnNetworkStatusChange</h2>

The boolean `notifyOnNetworkStatusChange` query option will trigger a new observable result every time the network status changes.
Network status indicates if any request is currently in flight for this query, and provides more information about what type of request it is (initial loading, refetch, setVariables, forceFetch). In previous versions, Apollo Client would not trigger a new result on the observable if loading status changed. For more information, refer to the react-apollo documentation.


<h2 id="reduxRootKey">reduxRootKey</h2>

The global `reduxRootKey` option was deprecated and has now been removed. In its place `reduxRootSelector` should be used. If you are not providing your own Redux store to Apollo, you do not need to set this option. `reduxRootSelector` is optional. 
If provided, it must be a function which returns the Apollo part of the store like so:

```js

const client = new ApolloClient({
  reduxRootSelector: (store) => store['myCustomStoreKey'],
});
```
