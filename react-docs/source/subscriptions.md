---
title: Subscriptions
---

In addition to fetching data using queries, GraphQL spec also has a solution for real-time notifications, called `subscription`.

Subscriptions are similar to queries - they contains the selection set (list of fields) you want in your client side, but those will be fetched on a live-stream (WebSocket).

Common usage of subscriptions is for notifying the client side regarding changes and notifications based on events: creation of a new object, updated fields and so on.

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

GraphQL subscription represents the definition of the notification, for example `commentAdded`, and the selection set (list of field) that required for the client side.

Subscription are an alternative for re-fetching queries using an interval: fetching the base state of the data using query, and then update it's store using the subscription notifications.

The above example for subscription will be triggered when a new comment will be added for a GitHub repository to GitHunt, and the client side response will contain:

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

<h2 id="common-usages">Common Usages</h2>

There are several possible implementation when working with subscription - choose the one the fit your application the most.

* You can either create a Query to fetch the basic data, and then update your data with subscriptions and `updateQueries`. When using this option, your subscription should publish the whole object that has been modified and you need to use it to update your Query's store.
* Another option is to fetch your data using Query, and use subscriptions to notify about data changes - this way, your client should use `refetch` after receiving the notification from the server.
* Subscribing without a Query is also possible and you can use it with `subscribe` API of Apollo-Client - use it for general notification that your client need, but usually don't need to store it's data locally.

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

> `subscriptions-transport-ws` is an extension for GraphQL - you can also use it without Apollo.

Then, create GraphQL subscriptions transport client (`SubscriptionClient`):

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true
});
```

Then, use your existing Apollo-Client network interface, and extend it using `addGraphQLSubscriptions` util method:

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

> To use subscriptions, you also need to adjust your GraphQL server and extend it with `graphql-subscriptions`, you can read more about it [here](/tools/graphql-server/subscriptions.html#setup).

<h2 id="subscribe-to-data">Subscribe to data</h2>

You can use subscription to extend an existing Query result, and use the same Redux store, by using `subscribeToMore` over your `react-apollo` Query result.

The following example uses Query to fetch all GitHunt comments for a repository, and then subscribe to new comments using GraphQL subscriptions.
The Redux store being updated using `updateQueries` and the data returned from the subscription, to reflect the new state of the query:

Let's start by wrapping the React component with our GraphQL query using `react-apollo` API, we'll also use `name` property to get access to the Query result:

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

Start by changing `withData` wrapper: exposing a method that will start our subscription into our component, using `props`.

We will also use `updateQueries` to update the store with the new comment.

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

Now, to start the actual subscription, use `subscribeToNewComments` method inside your React Component, for example:

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

<h2 id="subscribe-to-data">Authentication over WebSocket</h2>

`SubscriptionClient` constructor also accepts `connectionParams` field, which is a custom object you can pass to your server, and validate the connection is server side before creating your subscriptions.

You can use `connectionParams` for any use you need, not only authentication, and check it's validity in server side with [SubscriptionsServer](/tools/graphql-server/subscriptions.html#authentication).

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

Browser environment offers a native WebSocket implementation so you don't need to use any external WebSocket client. But in case you need to use `subscriptions-transport-ws` with NodeJS, you need to provide an implementation for WebSocket.

Pick any WebSocket client that supports NodeJS (`subscriptions-transport-ws` depends of `ws` which you can use), and pass to to `SubscriptionClient` constructor.

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
