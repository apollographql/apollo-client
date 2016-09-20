---
title: Getting updates from the server
---

Apollo Client caches the results of queries and then uses this cache in order to resolve parts of queries. However, what happens if the information in our cache goes stale? How do we make sure to update the cache if information changes on the server? How will our UI update to reflect this new information? This section will attempt to answer those questions.

A momentarily stale cache is an unavoidable problem. There's no feasible way to have a client-side cache and make sure that the cache will always immediately reflect the information on the server. For most applications, this isn't too much of an issue: your UI may be slightly out-of-date temporarily but it'll sync soon enough.

There are a few strategies you can implement to make sure that Apollo Client is eventually consistent with the information available to your server. These are: refetches, polling queries and GraphQL subscriptions.

## Refetch

Refetches are the simplest way to force a portion of your cache to reflect the information available to your server. Essentially, a refetch forces a query to immediately hit the server again, bypassing the cache. The result of this query, just like all other query results, updates the information available in the cache, which updates all of the query results on the page.

For example, using with the GitHunt schema, we might have the following component implementation:

```javascript
import React, { Component } from 'react';
import gql from 'grapqhl-tag';
import { graphql } from 'react-apollo';

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
  }`;

const FeedWithData = graphql(FeedEntries)(Feed);
```

Suppose we have a "refresh" button somewhere on the page and when that button is clicked, the `onRefreshClicked` method is called on our component. We have the method `this.props.data.refetch`, which allows us to refetch the query associated with the `FeedCompoment`. This means that instead of resolving information about the `feed` field from the cache (even if we have it!), the query will hit the server and will update the cache with new results from the server.

If there's been some kind of update on the server (e.g. a new repository added to the feed), the Apollo Client store will get the update and the UI will re-render as necessary.

In order for refetches to be a viable strategy, you need to know when to refetch a query. There are few different ways you could do this. For example, you could imagine refetching the whole feed when the user adds a new repository to it.

But, there are cases in which responding to user input to update the UI doesn't help, for example if some *other* user decides to insert a repository into the GitHunt feed and we want to show it. Our client has no idea that this has happened and won't see the new feed item until the page is refreshed. One solution to that problem is polling.

## Polling

If you have a query whose results can change pretty frequently, as the result of other users sending updates to the server, it makes sense to consider making a polling query. A polling query is fired on a particular time interval, and works similarly to a refetch.

Continuing with our refetch example, we can add a polling interval simply by adding one option to our query:

```javascript
const FeedWithData = graphql(FeedEntries, {
  options: { pollInterval: 20000 },
})(Feed);
```

The `pollInterval` option to a query sets a time interval in milliseconds, on which the query will be refetched. In this case, Apollo will take care of refetching this query every twenty seconds, making sure that your UI is only 20 seconds out of date at any given moment.

Generally, you shouldn't have polling intervals that are very small, say, less than 10 seconds. If you have data that changes frequently and it needs to reflect in the UI immediately, you should use GraphQL subscriptions, a feature coming soon to Apollo Client.

## Subscriptions

Coming soon!
