---
title: Syncing with the Server
sidebar_title: Syncing with the Server
---

Apollo Client caches the results of queries and then uses this cache to resolve queries when possible. You can control this behavior with the [fetch policy](api-queries.html#graphql-config-options-fetchPolicy) you use when asking for query data. However, what happens if the information in our cache goes stale? How do we make sure to update the cache if information changes on the server? How will our UI update to reflect this new information? This section will attempt to answer those questions.

There are a few strategies you can implement to make sure that Apollo Client is eventually consistent with the information available to your server. These are: manual refetches, polling queries and GraphQL subscriptions.

<h2 id="refetch">Refetch</h2>

Refetches are the simplest way to force a portion of your cache to reflect the information available to your server. Essentially, a refetch forces a query to immediately hit the server again, bypassing the cache. The result of this query, just like all other query results, updates the information available in the cache, which updates all of the query results on the page.

For example, using the GitHunt schema, we might have the following component implementation:

```javascript
import React, { Component } from 'react';
import { graphql, gql } from 'react-apollo';

class Feed extends Component {
  // ...
  onRefreshClicked() {
    this.props.data.refetch();
  }
  // ...
}

const FeedEntries = gql`
  query FeedEntries($type: FeedType!, $offset: Int, $limit: Int) {
    feed($type: NEW, offset: $offset, limit: $limit) {
      createdAt
      commentCount
      score
      id
      respository {
        # etc.
      }
    }
  }
`;

const FeedWithData = graphql(FeedEntries)(Feed);
```

Suppose we have a "refresh" button somewhere on the page and when that button is clicked, the `onRefreshClicked` method is called on our component. We have the method `this.props.data.refetch`, which allows us to refetch the query associated with the `Feed` component. This means that instead of resolving information about the `feed` field from the cache, the query will be forced to hit the server and update the cache with new results.

If there's been some kind of update on the server (e.g. a new repository added to the feed), the Apollo Client store will get the update and the UI will re-render as necessary.

<h3 id="when-to-refetch">When to refetch</h3>

In order for refetches to be a viable strategy, you need to know when to refetch a query. There are few different use cases where refetching makes sense.

1. **Manual refresh**: Many apps have a way for the user to manually request an updated view of their data, via a refresh button or pull down gesture. `refetch` is perfectly suited for this case.
2. **In response to event**: Sometimes, you know when an event has happened that might invalidate data. For example, you might have some sort of event pushing that tells you when data might have changed. Then, a `refetch` can be the best way to avoid polling unnecessarily.
3. **After a mutation**: There are [several ways](cache-updates.html) to make sure the store is up to date after a mutation, but the easiest way is to do a full refetch of the relevant queries. In this case, in addition to using the `refetch` method on the query itself, you can also use the [refetchQueries](api-mutations.html#graphql-mutation-options-refetchQueries) options on the mutation.

But, there are cases in which responding to user input or a mutation to update the UI doesn't help, for example if some *other* user decides to insert a repository into the GitHunt feed and we want to show it. Our client has no idea that this has happened and won't see the new feed item until the page is refreshed. One solution to that problem is polling.

<h3 id="polling">Polling</h3>

If you have a query whose results can change frequently, and you want to be looking at a relatively fresh view of the world, it makes sense to consider making a polling query. A polling query is fired on a particular time interval, but otherwise works similarly to a refetch.

Continuing with our refetch example, we can add a polling interval simply by adding one option to our query:

```javascript
const FeedWithData = graphql(FeedEntries, {
  options: { pollInterval: 20000 },
})(Feed);
```

The `pollInterval` option to a query sets a time interval in milliseconds, on which the query will be refetched. In this case, Apollo will take care of refetching this query every twenty seconds, making sure that your UI is only 20 seconds out of date at any given moment.

Generally, you shouldn't have polling intervals that are very small, say, less than 10 seconds. This is an easy way to cause a lot of load on your server. If you have data that needs to reflect in the UI immediately, you should use [GraphQL subscriptions](#subscriptions).

## Subscriptions

Subscriptions allow you to get near-realtime updates in your UI. Unlike polling, subscriptions are push-based, which means the server pushes updates to the client as soon as they are available. Subscriptions are more difficult to set up than polling, but they allow for more fine-grained control over updates, faster update times and may reduce the load on the server.

Building on our feedEntry example from above, we can make the `score` field update in real time by adding a subscription for that field:

```javascript

const SUBSCRIPTION_QUERY = gql`
  subscription scoreUpdates ($entryIds: [Int]){
    newScore(entryIds: $entryIds){
      id
      score
    }
  }
`;

class Feed extends Component {
  // ...
  componentWillReceiveProps(newProps) {
    if (!newProps.data.loading) {
      if (this.unsubscribe) {
        if (newProps.data.feed !== this.props.data.feed) {
          // if the feed has changed, we need to unsubscribe before resubscribing
          this.unsubscribe();
        } else {
          // we already have an active subscription with the right params
          return;
        }
      }

      const entryIds = newProps.data.feed.map(item => item.id);

      this.unsubscribe = newProps.data.subscribeToMore({
        document: SUBSCRIPTION_QUERY,
        variables: { entryIds },

        // this is where the magic happens.
        updateQuery: (previousResult, { subscriptionData }) => {
          const newScoreEntry = subscriptionData.data.newScore;

          const newResult = clonedeep(previousResult); // never mutate state!

          // update the score of the affected entry
          newResult.feed = newResult.feed.forEach(entry => {
            if(entry.id === newScoreEntry.id) {
              entry.score = newScoreEntry.score;
              return;
            }
          });

          return newResult;
        },
        onError: (err) => console.error(err),
      });
    }
  }
  // ...
}
```

In the example above, we keep the scores of all entries in the Feed component updated by making a subscription that lists all the ids of the feed entries currently displayed in the component. Every time a score is updated, the server will send a single response which contains an entry id and the new score.

`subscribeToMore` is a convenient way to update the result of a single query with a subscription. The `updateQuery` function passed to `subscribeToMore` runs every time a new subscription result arrives, and it's responsible for updating the query result.
`subscribeToMore` returns unsubscribe handler. 

The `subscribeToMore` subscription is stopped automatically when its dependent query is stopped, so we don't need to unsubscribe manually. We do however need to unsubscribe manually if the props changed and we need to make a new subscription with different variables.

For a more in-depth introduction to subscriptions in GraphQL, you may find our [blog post](https://dev-blog.apollodata.com/graphql-subscriptions-in-apollo-client-9a2457f015fb) on the topic interesting.
