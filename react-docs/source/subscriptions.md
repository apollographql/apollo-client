---
title: Subscriptions
---

In addition to fetching data using queries, there is also a proposed addition to the GraphQL spec that outlines a solution for real-time notifications, called `subscription`.

Subscriptions are similar to queries in that they also contain a selection set (list of fields), but instead of returning only once, a new result is sent every time a specified event happens on the server.

A common use-case for subscriptions is for notifying the client side of changes based on events, for example the creation of a new object, updated fields and so on.

```js
subscription onCommentAdded($repoFullName: String!){
  commentAdded(repoFullName: $repoFullName){
    id
    postedBy {
      login
      html_url
    }
    createdAt
    content
  }
}
```

GraphQL subscriptions contain the definition of the notification, for example `commentAdded`, and the selection set (list of field) that is requested by the client.

Subscriptions are a good alternative to polling when the initial state is large, but the incremental change sets are small. The starting state can be fetched with a query and subsequently updated through a subscription.

The above example for subscription will be triggered when a new comment is added on GitHunt for a specific repository. The response sent to the client looks as follows:

```json
{
    "commentAdded": {
        "id": "123",
        "postedBy": {
            "login": "my-username",
            "html-url": "http://..."
        },
        "createdAt": "13:21:00 10/02/2017",
        "content": "Hello!"
    }
}
```

<h2 id="common-usages">Common Usage</h2>

There are several possible implementation patterns when working with subscriptions, and you should choose the one that fits your application the most:

* You can either create a Query to fetch the basic data, and then update your data with subscriptions and if necessary `updateQueries`. When using this option, your subscription should publish the whole object that has been modified and you need to use it to update your Query's store.
* Another option is to fetch your data using Query, and use subscriptions to notify about data changes - this way, your client should use `refetch` after receiving the notification from the server.
* Subscribing without a Query is also possible and you can use it with `subscribe` API of Apollo-Client - use it for general notifications that your client needs, but doesn't have to store locally.

In the following example, we will use the first approach.

<h2 id="subscriptions-client">Subscriptions Client</h2>

To start with GraphQL subscriptions, install `subscriptions-transport-ws` from NPM:

```shell
npm install --save subscriptions-transport-ws
```

Or, using Yarn:

```shell
yarn add subscriptions-transport-ws
```

> `subscriptions-transport-ws` is an transport implementation for subscriptions - you can also use it without Apollo.

Then, create a subscriptions transport client (`SubscriptionClient`):

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true
});
```

Then, use your existing Apollo-Client network interface, and extend it using the `addGraphQLSubscriptions` function:

```js
import { addGraphQLSubscriptions } from 'subscriptions-transport-ws';

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

> To use subscriptions, you also need to extend your GraphQL server by adding `graphql-subscriptions`. You can read more about it [here](/tools/graphql-server/subscriptions.html#setup).

<h2 id="subscribe-to-data">subscribeToMore</h2>

You can use a subscription update an existing query result by using `subscribeToMore` on an `react-apollo` query result.

The following example uses a query to fetch all GitHunt comments for a repository, and then subscribe to new comments using GraphQL subscriptions.
The Redux store is updated using `updateQueries` with the data returned from the subscription to reflect the new state of the query.

Let's start by wrapping the React component with our GraphQL query using `react-apollo` API. We'll also use `name` property to get access to the Query result:

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

Now, let's add the subscriptions.

Start by modifying the `withData` wrapper to adding a `subscribeToNewComments` function to the `props` passed to the wrapped component.

```js
const COMMENTS_SUBSCRIPTION = gql`
    subscription onCommentAdded($repoFullName: String!){
      commentAdded(repoFullName: $repoFullName){
        id
        postedBy {
          login
          html_url
        }
        createdAt
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

Now, to start the actual subscription, use `subscribeToNewComments` method inside your React Component:

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

The `SubscriptionClient` constructor also accepts a `connectionParams` field, which is a custom object that is passed to your server, and lets the server validate the connection before setting up any subscriptions.

You can use `connectionParams` for anything else you might need, not only authentication, and check its payload on the server side with [SubscriptionsServer](/tools/graphql-server/subscriptions.html#authentication).

```js
import {SubscriptionClient} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        authToken: user.authToken,
    },
});
```

<h2 id="nodejs-client">NodeJS Subscriptions Client</h2>

Browser environments have a native WebSocket implementation so you don't need to use any external WebSocket client. But in case you want to use `subscriptions-transport-ws` with NodeJS, you need to provide a polyfill for WebSocket.

Pick any WebSocket client that supports NodeJS (`subscriptions-transport-ws` uses `ws`), and pass it to the `SubscriptionClient` constructor.

```js
import * as WebSocket from 'ws';
import {SubscriptionClient} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        authToken: user.authToken,
    },
}, WebSocket);
```
