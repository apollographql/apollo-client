---
title: Subscriptions
---

In addition to fetching data using queries and modifying data using mutations, the GraphQL spec supports a third operation type, called `subscription`.

GraphQL subscriptions are a way to push data from the server to the clients that choose to listen to real time messages from the server. Subscriptions are similar to queries in that they specify a set of fields to be delivered to the client, but instead of immediately returning a single answer, a result is sent every time a particular event happens on the server.

A common use case for subscriptions is notifying the client side about particular events, for example the creation of a new object, updated fields and so on.

<h2 id="overview">Overview</h2>

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

In the above example, the server is written to send a new result every time a comment is added on GitHunt for a specific repository. Note that the code above only defines the GraphQL subscription in the schema. Read [setting up subscriptions on the client](#subscriptions-client) and [setting up GraphQL subscriptions for the server](https://www.apollographql.com/docs/graphql-subscriptions/index.html) to learn how to add subscriptions to your app.

<h3 id="when-to-use">When to use subscriptions</h3>

In most cases, intermittent polling or manual refetching are actually the best way to keep your client up to date. So when is a subscription the best option? Subscriptions are especially useful if:

1. The initial state is large, but the incremental change sets are small. The starting state can be fetched with a query and subsequently updated through a subscription.
2. You care about low-latency updates in the case of specific events, for example in the case of a chat application where users expect to receive new messages in a matter of seconds.

A future version of Apollo or GraphQL might include support for live queries, which would be a low-latency way to replace polling, but at this point general live queries in GraphQL are not yet possible outside of some relatively experimental setups.

<h2 id="subscriptions-client">Client setup</h2>

The most popular transport for GraphQL subscriptions today is [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws). This package is maintained by the Apollo community, but can be used with any client or server GraphQL implementation. In this article, we'll explain how to set it up on the client, but you'll also need a server implementation. You can [read about how to use subscriptions with a JavaScript server](/docs/graphql-subscriptions/setup.html), or enjoy subscriptions set up out of the box if you are using a GraphQL backend as a service like [Graphcool](https://www.graph.cool/docs/tutorials/worldchat-subscriptions-example-ui0eizishe/) or [Scaphold](https://scaphold.io/blog/2016/11/09/build-realtime-apps-with-subs.html).

Let's look at how to add support for this transport to Apollo Client.

First, install the WebSocket Apollo Link (`apollo-link-ws`) from npm:

```shell
npm install --save apollo-link-ws
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
    const { kind, operation } = getMainDefinition(query);
    return kind === 'OperationDefinition' && operation === 'subscription';
  },
  wsLink,
  httpLink,
);

```

Now, queries and mutations will go over HTTP as normal, but subscriptions will be done over the websocket transport.

<h2 id="subscribe-to-more">subscribeToMore</h2>

With GraphQL subscriptions your client will be alerted on push from the server and you should choose the pattern that fits your application the most:

* Use it as a notification and run any logic you want when it fires, for example alerting the user or refetching data
* Use the data sent along with the notification and merge it directly into the store (existing queries are automatically notified)

With `subscribeToMore`, you can easily do the latter.

`subscribeToMore` is a function available on every query result in `react-apollo`. It works just like [`fetchMore`](cache-updates.html#fetchMore), except that the update function gets called every time the subscription returns, instead of only once.

Here is a regular query:

```js
import { CommentsPage } from './comments-page.js';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

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

const withData = graphql(COMMENT_QUERY, {
    name: 'comments',
    options: ({ params }) => ({
        variables: {
            repoName: `${params.org}/${params.repoName}`
        },
    })
});

export const CommentsPageWithData = withData(CommentsPage);
```

Now, let's add the subscription.

Add a function called `subscribeToNewComments` that will subscribe using `subscribeToMore` and update the query's store with the new data using `updateQuery`.

Note that the `updateQuery` callback must return an object of the same shape as the initial query data, otherwise the new data won't be merged. Here the new comment is pushed in the `comments` list of the `entry`:

```js
const COMMENTS_SUBSCRIPTION = gql`
    subscription onCommentAdded($repoFullName: String!){
      commentAdded(repoFullName: $repoFullName){
        id
        content
      }
    }
`;

const withData = graphql(COMMENT_QUERY, {
    name: 'comments',
    options: ({ params }) => ({
        variables: {
            repoName: `${params.org}/${params.repoName}`
        },
    }),
    props: props => {
        return {
           ...props,
            subscribeToNewComments: params => {
                return props.comments.subscribeToMore({
                    document: COMMENTS_SUBSCRIPTION,
                    variables: {
                        repoName: params.repoFullName,
                    },
                    updateQuery: (prev, {subscriptionData}) => {
                        if (!subscriptionData.data) {
                            return prev;
                        }

                        const newFeedItem = subscriptionData.data.commentAdded;

                        return Object.assign({}, prev, {
                            entry: {
                                comments: [newFeedItem, ...prev.entry.comments]
                            }
                        });
                    }
                });
            }
        };
    },
});
```

and start the actual subscription by calling the `subscribeToNewComments` function with the subscription variables:

```js
export class CommentsPage extends Component {
    componentDidMount() {
        this.props.subscribeToNewComments({
            repoFullName: this.props.repoFullName,
        });
    }
}
```

<h2 id="authentication">Authentication over WebSocket</h2>

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

> You can use `connectionParams` for anything else you might need, not only authentication, and check its payload on the server side with [SubscriptionsServer](/docs/graphql-subscriptions/authentication.html).
