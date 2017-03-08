---
title: Subscriptions
---

In addition to fetching data using queries and modifying data using mutations, GraphQL spec also has a third operation type, called `subscription`.

GraphQL Subscriptions is a way to push data from the server to the clients that choose to listen to real time messages from the server.  

similar to queries - they contain the selection set (list of fields) the client side needs, but those will be pushed from the server on the specific subscription name.

Common usage of subscriptions is for notifying the client side regarding changes and notifications based on events: creation of a new object, updated fields and so on.

A server will expose a schema like so:

```js
type Subscription {
  commentAdded(repoFullName: String!): Comment
}
```

and the client will listen to `onCommentAdded` subscription and choose a selection set from it:

```js
subscription onCommentAdded($repoFullName: String!){
  commentAdded(repoFullName: $repoFullName){
    id
    content
  }
}
```

The above example for subscription will be triggered when a new comment will be added for a GitHub repository to GitHunt, and the client will recieve the following payload:

```json
{
    "commentAdded": {
        "id": "123",
        "content": "Hello!"
    }
}
```

> Subscriptions can be an alternative for re-fetching queries using polling.

<h2 id="subscriptions-client">Getting started</h2>

To start using GraphQL subscriptions on the client, using a WebSocaket transport, install `subscriptions-transport-ws` from npm:

```shell
npm install --save subscriptions-transport-ws
```

> `subscriptions-transport-ws` is a library for GraphQL - you can also use it without Apollo.

> Read [here](/tools/graphql-server/subscriptions.html#setup) on how to setup GraphQL subscriptions on your server.

Then, create GraphQL subscriptions transport client (`SubscriptionClient`):

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true
});
```

and extend your existing Apollo-Client network interface using `addGraphQLSubscriptions` util method:

```js
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

<h2 id="subscribe-to-data">Subscribe to data</h2>

With GraphQL subscriptions your client will be alerted on push from the server and you can choose how to handle it:

* Just use it as a notification and run any logic you want when it happens, for example alerting the user or refetching data
* Use the subscription's selection set to get data with the notification and merge that data into the store

We will focus on the latter.

First you will need to define a GraphQL query and then extend it using `subscribeToMore` with the new data from the subscription.

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

and start the actual subscription using `subscribeToNewComments` method with the subscription variables:

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

`SubscriptionClient` constructor also accepts `connectionParams` field, which is a custom object you can pass to your server, and validate the connection is server side before creating your subscriptions.

> You can read about authentication on the server [here](/tools/graphql-server/subscriptions.html#authentication).

```js
import {SubscriptionClient} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        authToken: user.authToken,
    },
});
```

> You can use `connectionParams` for any use you need, not only authentication.