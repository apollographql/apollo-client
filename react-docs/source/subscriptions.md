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

<h2 id="subscriptions-client">Subscriptions Client</h2>

To start with GraphQL subscriptions, install `subscriptions-transport-ws` from NPM:

```shell
npm install --save subscriptions-transport-ws
```

Or, using Yarn:

```shell
yarn add subscriptions-transport-ws
```

Then, create GraphQL subscriptions transport client (`SubscriptionClient`):

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(`http://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        // Pass any arguments you want for initialization
    }
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
