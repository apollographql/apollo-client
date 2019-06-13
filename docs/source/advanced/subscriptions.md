---
title: Subscriptions
description: Learn how to achieve realtime data with GraphQL subscriptions
---

In addition to fetching data using queries and modifying data using mutations, the GraphQL spec supports a third operation type, called `subscription`.

GraphQL subscriptions are a way to push data from the server to the clients that choose to listen to real time messages from the server. Subscriptions are similar to queries in that they specify a set of fields to be delivered to the client, but instead of immediately returning a single answer, a result is sent every time a particular event happens on the server.

A common use case for subscriptions is notifying the client side about particular events, for example the creation of a new object, updated fields and so on.

> This is an advanced feature that Apollo Boost does not support. Learn how to set Apollo Client up manually in our [Apollo Boost migration guide](/advanced/boost-migration/).

## Overview

GraphQL subscriptions have to be defined in the schema, just like queries and mutations:

```js
type Subscription {
  commentAdded(repoFullName: String!): Comment
}
```

On the client, subscription queries look just like any other kind of operation:

```js
subscription onCommentAdded($repoFullName: String!){
  commentAdded(repoFullName: $repoFullName){
    id
    content
  }
}
```

The response sent to the client looks as follows:

```json
{
  "data": {
    "commentAdded": {
      "id": "123",
      "content": "Hello!"
    }
  }
}
```

In the above example, the server is written to send a new result every time a comment is added on GitHunt for a specific repository. Note that the code above only defines the GraphQL subscription in the schema. Read [setting up subscriptions on the client](#client-setup) and [setting up GraphQL subscriptions for the server](https://www.apollographql.com/docs/graphql-subscriptions) to learn how to add subscriptions to your app.

### When to use subscriptions

In most cases, intermittent polling or manual refetching are actually the best way to keep your client up to date. So when is a subscription the best option? Subscriptions are especially useful if:

1. The initial state is large, but the incremental change sets are small. The starting state can be fetched with a query and subsequently updated through a subscription.
2. You care about low-latency updates in the case of specific events, for example in the case of a chat application where users expect to receive new messages in a matter of seconds.

A future version of Apollo or GraphQL might include support for live queries, which would be a low-latency way to replace polling, but at this point general live queries in GraphQL are not yet possible outside of some relatively experimental setups.

## Client setup

The most popular transport for GraphQL subscriptions today is [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws). This package is maintained by the Apollo community, but can be used with any client or server GraphQL implementation. In this article, we'll explain how to set it up on the client, but you'll also need a server implementation. You can [read about how to use subscriptions with a JavaScript server](https://www.apollographql.com/docs/graphql-subscriptions/setup), or enjoy subscriptions set up out of the box if you are using a GraphQL backend as a service like [Graphcool](https://www.graph.cool/docs/tutorials/worldchat-subscriptions-example-ui0eizishe/) or [Scaphold](https://scaphold.io/blog/2016/11/09/build-realtime-apps-with-subs.html).

Let's look at how to add support for this transport to Apollo Client.

First, install the WebSocket Apollo Link (`apollo-link-ws`) from npm:

```shell
npm install --save apollo-link-ws subscriptions-transport-ws
```

Then, initialize a GraphQL subscriptions transport link:

```js
import { WebSocketLink } from 'apollo-link-ws';

const wsLink = new WebSocketLink({
  uri: `ws://localhost:5000/`,
  options: {
    reconnect: true
  }
});
```

```js
import { split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';

// Create an http link:
const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql'
});

// Create a WebSocket link:
const wsLink = new WebSocketLink({
  uri: `ws://localhost:5000/`,
  options: {
    reconnect: true
  }
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
  // split based on operation type
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);
```

Now, queries and mutations will go over HTTP as normal, but subscriptions will be done over the websocket transport.

## Subscription Component

The easiest way to bring live data to your UI is using the Subscription component from React Apollo. This lets you render the stream of data from your service directly within your render function of your component! One thing to note, subscriptions are just listeners, they don't request any data when first connected, but only open up a connection to get new data. Binding live data to your UI is as easy as this:

```js
const COMMENTS_SUBSCRIPTION = gql`
  subscription onCommentAdded($repoFullName: String!) {
    commentAdded(repoFullName: $repoFullName) {
      id
      content
    }
  }
`;

const DontReadTheComments = ({ repoFullName }) => (
  <Subscription
    subscription={COMMENTS_SUBSCRIPTION}
    variables={{ repoFullName }}
  >
    {({ data: { commentAdded }, loading }) => (
      <h4>New comment: {!loading && commentAdded.content}</h4>
    )}
  </Subscription>
);
```

## Subscription Component API overview

If you're looking for an overview of all the props `Subscription` accepts and its render prop function, look no further!

### Props

The Subscription component accepts the following props. Only `subscription` and `children` are **required**.

<dl>
  <dt>`subscription`: DocumentNode</dt>
  <dd>A GraphQL subscription document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (result: SubscriptionResult) => React.ReactNode</dt>
  <dd>A function returning the UI you want to render based on your subscription result.</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your subscription needs to execute</dd>
  <dt>`shouldResubscribe`: boolean | (currentProps: Object, nextProps: Object) => boolean</dt>
  <dd>Determines if your subscription should be unsubscribed and subscribed again. By default, the component will only resubscribe if `variables` or `subscription` props change.</dd>
  <dt>`onSubscriptionData`: (options: OnSubscriptionDataOptions&lt;TData&gt;) => any</dt>
  <dd>Allows the registration of a callback function, that will be triggered each time the `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `subscriptionData`.</dd>
  <dt>`fetchPolicy`: FetchPolicy</dt>
  <dd>How you want your component to interact with the Apollo cache. Defaults to "cache-first".</dd>
</dl>

### Render prop function

The render prop function that you pass to the `children` prop of `Subscription` is called with an object that has the following properties

<dl>
  <dt>`data`: TData</dt>
  <dd>An object containing the result of your GraphQL subscription. Defaults to an empty object.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean that indicates whether any initial data has been returned</dd>
  <dt>`error`: ApolloError</dt>
  <dd>A runtime error with `graphQLErrors` and `networkError` properties</dd>
</dl>

## subscribeToMore

With GraphQL subscriptions your client will be alerted on push from the server and you should choose the pattern that fits your application the most:

* Use it as a notification and run any logic you want when it fires, for example alerting the user or refetching data
* Use the data sent along with the notification and merge it directly into the store (existing queries are automatically notified)

With `subscribeToMore`, you can easily do the latter.

`subscribeToMore` is a function available on every query result in `react-apollo`. It works just like [`fetchMore`](/advanced/caching/#incremental-loading-fetchmore), except that the update function gets called every time the subscription returns, instead of only once.

Here is a regular query:

```js
const COMMENT_QUERY = gql`
  query Comment($repoName: String!) {
    entry(repoFullName: $repoName) {
      comments {
        id
        content
      }
    }
  }
`;

const CommentsPageWithData = ({ params }) => (
  <Query
    query={COMMENT_QUERY}
    variables={{ repoName: `${params.org}/${params.repoName}` }}
  >
    {result => <CommentsPage {...result} />}
  </Query>
);
```

Now, let's add the subscription.

Add a function called `subscribeToNewComments` that will subscribe using `subscribeToMore` and update the query's store with the new data using `updateQuery`.

Note that the `updateQuery` callback must return an object of the same shape as the initial query data, otherwise the new data won't be merged. Here the new comment is pushed in the `comments` list of the `entry`:

```js
const COMMENT_QUERY = gql`
  query Comment($repoName: String!) {
    entry(repoFullName: $repoName) {
      comments {
        id
        content
      }
    }
  }
`;

const COMMENTS_SUBSCRIPTION = gql`
  subscription onCommentAdded($repoName: String!) {
    commentAdded(repoName: $repoName) {
      id
      content
    }
  }
`;

const CommentsPageWithData = ({ params }) => (
  <Query
    query={COMMENT_QUERY}
    variables={{ repoName: `${params.org}/${params.repoName}` }}
  >
    {({ subscribeToMore, ...result }) => (
      <CommentsPage
        {...result}
        subscribeToNewComments={() =>
          subscribeToMore({
            document: COMMENTS_SUBSCRIPTION,
            variables: { repoName: params.repoName },
            updateQuery: (prev, { subscriptionData }) => {
              if (!subscriptionData.data) return prev;
              const newFeedItem = subscriptionData.data.commentAdded;

              return Object.assign({}, prev, {
                entry: {
                  comments: [newFeedItem, ...prev.entry.comments]
                }
              });
            }
          })
        }
      />
    )}
  </Query>
);
```

and start the actual subscription by calling the `subscribeToNewComments` function with the subscription variables:

```js
export class CommentsPage extends Component {
  componentDidMount() {
    this.props.subscribeToNewComments();
  }
}
```

## Authentication over WebSocket

In many cases it is necessary to authenticate clients before allowing them to receive subscription results. To do this, the `SubscriptionClient` constructor accepts a `connectionParams` field, which passes a custom object that the server can use to validate the connection before setting up any subscriptions.

```js
import { WebSocketLink } from 'apollo-link-ws';

const wsLink = new WebSocketLink({
  uri: `ws://localhost:5000/`,
  options: {
    reconnect: true,
    connectionParams: {
        authToken: user.authToken,
    },
});
```

> You can use `connectionParams` for anything else you might need, not only authentication, and check its payload on the server side with [SubscriptionsServer](https://www.apollographql.com/docs/graphql-subscriptions/authentication).
