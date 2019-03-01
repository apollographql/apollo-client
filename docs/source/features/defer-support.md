---
title: Deferred queries
description: Optimize data loading with the @defer directive
---

<h2 id="defer-setup">Setting up</h2>

> Note: `@defer` support is an **experimental feature** that is only available in alpha versions of Apollo Server and Apollo Client.

- On the server:

  ```
  npm install apollo-server@alpha
  ```

- On the client, if you are using Apollo Boost:
  ```
  npm install apollo-boost@alpha react-apollo@alpha
  ```
  Or if you are using Apollo Client:
  ```
  npm install apollo-client@alpha apollo-cache-inmemory@alpha apollo-link-http@alpha apollo-link-error apollo-link react-apollo@alpha
  ```

<h2 id="defer">The `@defer` Directive</h2>

Many applications that use Apollo fetch data from a variety of microservices, which may each have varying latencies and cache characteristics. Apollo comes with a built-in directive for deferring parts of your GraphQL query in a declarative way, so that fields that take a long time to resolve do not need to slow down your entire query.

There are 3 main reasons why you may want to defer a field:

1.  **Field is expensive to load.** This includes private data that is not cached (like user progress), or information that requires more computation on the backend (like calculating price quotes on Airbnb).
2.  **Field is not on the critical path for interactivity.** This includes the comments section of a story, or the number of claps received.
3.  **Field is expensive to send.** Even if the field may resolve quickly (ready to send back), users might still choose to defer it if the cost of transport is too expensive.

As an example, take a look at the following query that populates a NewsFeed page:

```graphql
query NewsFeed {
  newsFeed {
    stories {
      id
      title
      comments {
        id
        text
      }
    }
    recommendedForYou {
      story {
        id
        title
        comments {
          id
          text
        }
      }
      matchScore
    }
  }
}
```

It is likely that the time needed for different fields in a query to resolve are significantly different. `stories` is highly public data that we can cache in CDNs (fast), while `recommendedForYou` is personalized and may need to be computed for every user (slooow). Also, we might not need `comments` to be displayed immediately, so slowing down our query to wait for them to be fetched is not the best idea.

<h2 id="defer-how">How to use `@defer`</h2>

We can optimize the above query with `@defer`:

```graphql
query NewsFeed {
  newsFeed {
    stories {
      id
      title
      comments @defer {
        id
        text
      }
    }
    recommendedForYou @defer {
      story {
        id
        title
        comments @defer {
          id
          text
        }
      }
      matchScore
    }
  }
}
```

Once you have added `@defer`, Apollo Server will return an initial response without waiting for deferred fields to resolve, using `null` as placeholders for them. Then, it streams patches for each deferred field asynchronously as they resolve.

```json
// Initial response
{
  "data": {
    "newsFeed": {
      "stories": [{ "id": "...", "title": "...", "comments": null }],
      "recommendedForYou": null
    }
  }
}
```

```json
// Patch for "recommendedForYou"
{
  "path": ["newsFeed", "recommendedForYou"],
  "data": [
    {
      "story": {
        "id": "...",
        "title": "...",
        "comments": null
      },
      "matchScore": 99
    }
  ]
}
```

```json
// Patch for "comments", sent for each story
{
  "path": ["newsFeed", "stories", 1, "comments"],
  "data": [
    {
      "text": "..."
    }
  ]
}
```

If an error is thrown within a resolver, the error gets sent along with its closest deferred parent, and is merged with the `graphQLErrors` array on the client.

```json
// Patch for "comments" if there is an error
{
  "path": ["newsFeed", "stories", 1, "comments"],
  "data": null,
  "errors": [
    {
      "message": "Failed to fetch comments"
    }
  ]
}
```

<h3 id="defer-loadingstate">Distinguishing between "pending" and "null"</h3>

You may have noticed that deferred fields are returned as `null` in the initial response. So how can we know which fields are pending so that we can show some loading indicator? To deal with that, Apollo Client now exposes field-level loading information in a new property called `loadingState` that you can check for in your UI components. The shape of `loadingState` mirrors that of your data. For example, if `data.newsFeed.stories` is ready, `loadingState.newsFeed.stories` will be `true`.

You can use it in a React component like this:

```jsx harmony
<Query query={query}>
  {({ loading, error, data, loadingState }) => {
    if (loading) return 'loading...';
    return loadingState.newsFeed.recommendedForYou
      ? data.newsFeed.recommendedForYou
        ? data /* render component here */
        : 'No recommended content'
      : 'Loading recommended content';
  }}
</Query>
```

<h2 id="defer-usage">Where is `@defer` allowed?</h2>

- `@defer` can be applied on any `FIELD` of a `Query` operation. It also takes an optional argument `if`, that is a `boolean` controlling whether it is active, similar to `@include`.

- `@include` and `@skip` take precedence over `@defer`.

- Mutations: Not supported.

- Non-Nullable Types: Not allowed and will throw a validation error. This is because deferred fields are returned as `null` in the initial response. Deferring non-nullable types may also lead to unexpected behavior when errors occur, since errors will propagate up to the nearest nullable parent as per the GraphQL spec. We want to avoid letting errors on deferred fields clobber the initial data that was loaded already.

- Nesting: `@defer` can be nested arbitrarily. For example, we can defer a list type, and defer a field on an object in the list. During execution, we ensure that the patch for a parent field will be sent before its children, even if the child object resolves first. This will simplify the logic for merging patches.

- GraphQL fragments: Supported. If there are multiple declarations of a field within the query, **all** of them have to contain `@defer` for the field to be deferred. This could happen if we have use a fragment like this:

  ```graphql
  fragment StoryDetail on Story {
    id
    title
  }
  query {
    newsFeed {
      stories {
        title @defer
        ...StoryDetail
      }
    }
  }
  ```
  In this case, `text` will not be deferred since `@defer` was not applied in the fragment definition.

  A common pattern around fragments is to bind it to a component and reuse them across different parts of your UI. This is why it would be ideal to make sure that the `@defer` behavior of fields in a fragment is not overridden.

<h2 id="defer-transport">Transport</h2>

There is no additional setup for the transport required to use `@defer`. By default, deferred responses are transmitted using [Multipart HTTP](https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html). For browsers that do not support the [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API used to read streaming responses, we will just fallback to normal query execution ignoring `@defer`.

<h2 id="defer-performance">Performance Considerations</h2>

`@defer` is one of those features that work best if used in moderation. If it is used too granularly (on many nested fields), the overhead of performing patching and re-rendering could be worse than just waiting for the full query to resolve. Try to limit `@defer` to fields that take a significantly longer time to load. This is super easy to figure out if you have Apollo Engine set up!

<h2 id="defer-preloading">Preloading Data with `@defer`</h2>

Another super useful pattern for using `@defer` is preloading data that will be required in subsequent views. For illustration, imagine that each story has a `text` field that takes a long time to load. `text` is not required when we load the newsfeed view - we only need it to show the story detail view, which makes a query like this:

```graphql
query StoryDetail($id: ID!) {
  story(id: $id) {
    id
    title
    text @defer
    comments @defer {
      id
      text
    }
  }
}
```

However, instead for waiting for the user to navigate to the story detail view before firing that query, we could add `text` as a deferred field when we first load the newsfeed. This will allow `text` to preload in the background for all the stories. 

```graphql
query NewsFeed {
  newsFeed {
    stories {
      id
      title
      text @defer # Not needed now, but preload it first
      comments @defer {
        id
        text
      }
    }
  }
}
```

Then, we will need to set up a [cache redirect](https://www.apollographql.com/docs/react/advanced/caching.html#cacheRedirect) to tell Apollo Client where to look for cached data for the `StoryDetail` query.

```javascript
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cacheRedirects: {
    Query: {
      story: (_, { id }, { getCacheKey }) =>
        getCacheKey({ __typename: 'Story', id }),
    },
  },
});
```

Now, when the user navigates to each story detail view, it will load instantly as the data required is already fetched and stored in the cache. 
  

<h2 id="defer-servers">Use with other GraphQL servers</h2>

If you are sending queries to a GraphQL server that does not support `@defer`, it is likely that the `@defer` directive is simply ignored, or a GraphQL validation error is thrown: `Unknown directive "defer"`

To implement a GraphQL server that will interoperate with Apollo Client for `@defer` support, please look at the [specification here](https://github.com/apollographql/apollo-server/blob/defer-support/docs/source/defer-support.md).
