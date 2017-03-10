---
title: Subscriptions
---

In addition to fetching data using queries and modifying data using mutations, GraphQL spec also has a third operation type, called `subscription`.

GraphQL Subscriptions is a way to push data from the server to the clients that choose to listen to real time messages from the server.  

Subscriptions are similar to queries in that they specify the selection set (list of fields) that the client is requesting, but instead of immediately returning a single answer, a result is sent every time a specified event happens on the server.

A common use-case for subscriptions is notifying the client side of changes based on events, for example the creation of a new object, updated fields and so on.

GraphQL subscriptions have to be defined in the schema:

```js
type Subscription {
  commentAdded(repoFullName: String!): Comment
}
```

A client can subscribe by sending a subscription query:

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

In the above example, the subscription is expected to send a new result every time a comment is added on GitHunt for a specific repository. Note that the code above only defines the GraphQL subscription in the schema. Read [setting up subscriptions on the client](#subscriptions-client) and [setting up GraphQL subscriptions for the server](http://dev.apollodata.com/tools/graphql-subscriptions/index.html) to learn how to add subscriptions to your app.

> Subscriptions are a good alternative to polling when the initial state is large, but the incremental change sets are small. The starting state can be fetched with a query and subsequently updated through a subscription.


<h2 id="subscriptions-client">Setting up subscriptions on the client</h2>

To start using GraphQL subscriptions on the client with a WebSocaket transport, install `subscriptions-transport-ws` from npm:

```shell
npm install --save subscriptions-transport-ws
```

> `subscriptions-transport-ws` is an transport implementation for subscriptions that works with any server or client, not only Apollo.

> Read [here](/tools/graphql-server/subscriptions.html#setup) on how to setup GraphQL subscriptions on your server.

Then, create a GraphQL subscriptions transport client (`SubscriptionClient`):

```js
import {SubscriptionClient} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true
});
```

and extend your existing Apollo-Client network interface using the `addGraphQLSubscriptions` function:

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';

// Create regular NetworkInterface by using apollo-client's API:
const networkInterface = createNetworkInterface({
 uri: 'http://localhost:3000'
});

// Extend the network interface with the WebSocket
const networkInterfaceWithSubscriptions = addGraphQLSubscriptions(
    networkInterface,
    wsClient
);

// Finally, create your ApolloClient instance with the modified network interface
const apolloClient = new ApolloClient({
    networkInterface: networkInterfaceWithSubscriptions
});
```

<h2 id="subscribe-to-more">subscribeToMore</h2>

With GraphQL subscriptions your client will be alerted on push from the server and you should choose the pattern that fits your application the most:

* use it as a notification and run any logic you want when it fires, for example alerting the user or refetching data
* use the data sent along with the notification and merge it directly into the store (existing queries are automatically notified)

`subscribeToMore` lets you do the latter easily.

`subscribeToMore` is a function available on every query result in `react-apollo`. It works just like [`fetchMore`](/react/cache-updates.html#fetchMore), except that the update function gets called every time the subscription returns, instead of only once.

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

Add a function called `subscribeToNewComments` that will subscribe using `subscribeToMore` and update the query's store with the new data using `updateQuery`:

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
                                comments: [newFeedItem, ...prev.entry.activities]
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
    static propTypes = {
        repoFullName: PropTypes.string.isRequired,
        subscribeToNewComments: PropTypes.func.isRequired,
    }

    componentWillMount() {
        this.props.subscribeToNewComments({
            repoFullName: this.props.repoFullName,
        });
    }
}
```

<h2 id="authentication">Authentication over WebSocket</h2>

In many cases it is necessary to authenticate clients before allowing them to receive subscription results. To do this, the `SubscriptionClient` constructor accepts a `connectionParams` field, which passes a custom object that the server can use to validate the connection before setting up any subscriptions.

```js
import {SubscriptionClient} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        authToken: user.authToken,
    },
});
```

> You can use `connectionParams` for anything else you might need, not only authentication, and check its payload on the server side with [SubscriptionsServer](/tools/graphql-server/subscriptions.html#authentication).
