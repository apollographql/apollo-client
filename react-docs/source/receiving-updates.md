---
title: Getting updates from the server
order: 12
---

Apollo Client caches the results of queries and then uses this cache in order to resolve parts of queries. However, what happens if the information in our cache goes out of date, i.e. the cache becomes stale? How do we make sure that we can update the cache if information changes on the server? How will our UI update to reflect this new information? These are questsions that this section should answer.

A momentarily stale cache is an unavoidable problem. There's no feasible way to have a client-side cache and make sure that the cache will *always* reflect exactly the information that is available on the server. For pretty much any application, this isn't too much of an issue: your UI may be slightly out-of-date temporarily, but, it'll sync soon enough. There are a few strategies to make sure that Apollo Client is eventually consistent with the information available to your server. These are: refetches, polling queries and GraphQL subscriptions.

## Refetches
Refetches are the simplest way to force a portion of your cache to reflect the information available to your server. Essentially, a refetch forces a query to hit the server, bypassing the cache entirely. The result of this query, just like all other query results, will update the information available in the cache.

For example, continuing with the GitHunt schema, we may have the following component implementation:

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
        // etc.
      }
    }
  }`;

const FeedWithData = graphql(FeedEntries)(Feed);
```

In particular, suppose we have a "refresh" button somewhere on the page and when that button is clicked, the `onRefreshClicked` method is called on our component. We have the method `this.props.data.refetch`, which allows us to refetch the query associated with the `FeedCompoment`. This means that instead of resolving information about the `feed` field from the cache (even if we have it!), the query will hit the server and will update the cache with new results from the server.

So, if there's been some kind of update in the information that the query requests (e.g. a new repository added to the feed), the Apollo Client store will have the update and the UI will re-render as necessary.

In order for refetches to be a viable strategy, you must have some idea as to when you should refetch a query (i.e. when information in the cache has gone stale). This is possible in many circumstances. For example, you could imagine refetching the whole feed when the user adds a new repository to it. But, there are cases in which this does not work, e.g. some *other* user decides to insert a repository into the GitHunt feed. Then, our client has no idea that this has happened and won't see the new feed item until the page is refreshed. One solution to that problem is polling.

## Polling
If you have a query whose result can change pretty frequently, it probably makes sense to consider making a polling query. A polling query is a GraphQL query which is fired on a particular interval and every time it is fired, it is fired as a refetch, i.e. no part of it is resolved from the cache. By doing this, the portion of the cache that the query touches will be updated on the polling interval and will be consistent with the information that is on the server.

Continuing with our refetch example, we can add a polling interval with an additional option:

```javascript
const FeedWithData = graphql(FeedEntries, {
  options: (props) => {
    return { pollInterval: 20000 };
  },
})(Feed);

```

By adding a function that returns the options for this particular component and setting a `pollInterval` key within the options, we can set the polling interval in milliseconds. Apollo will then take care of refetching this query every twenty seconds and your UI will be updated with the newest information from the server every twenty seconds.

Generally, you shouldn't have polling intervals that are very small, say, less than 10 seconds. If you have data that changes this frequently and need those updates on your client that quickly, you should use GraphQL subscriptions.

<!-- ## Subscriptions -->
