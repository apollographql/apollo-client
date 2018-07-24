---
title: Defer Support
description: Optimize data loading with the @defer directive
---

<h2 id="defer">The @defer Directive</h2>

Many applications that use Apollo fetch data from a variety of microservices, which may all have varying latencies and cache characteristics. Apollo comes with a built-in directive for deferring parts of your GraphQL query in a declarative way, so that fields that take a long time to resolve do not need to slow down your entire query.

There are 3 main reasons why you may want to defer a field:

1.  **Field is expensive to load.** This includes private data that is not cached (like user progress), or information that requires more computation on the backend (like calculating price quotes on Airbnb).
2.  **Field is not on the critical path for interactivity.** This includes the comments section of a story, or the number of claps received.
3.  **Field is expensive to send.** Even if the field may resolve quickly (ready to send back), users might still choose to defer it if the cost of transport is too expensive.

<h3 id="defer-example">Motivating Example</h3>
```graphql
query NewsFeed {
  newsFeed {
    stories {
      text
      comments {
        text
      }
    }
    recommendedForYou {
      story {
        text
        comments {
          text
        }
      }
      matchScore 
    }
  }
}
```
Given the above query that populates a NewsFeed page, observe that the time needed for different fields to resolve may be significantly different. `stories` is highly public data that we can cache in CDNs (fast), while `recommendedForYou` is personalized and may need to be computed for every user (slooow). Also, we might not need `comments` to be displayed immediately, so slowing down our query to wait for them to be fetched is not the best idea.

We can rewrite the above query with `@defer`:

```graphql
query NewsFeed {
  newsFeed {
    stories {
      text
      comments @defer {
        text
      }
    }
    recommendedForYou @defer {
      story {
        text
        comments @defer {
          text
        }
      }
      matchScore
    }
  }
}
```

Under the hood, Apollo Server will return an initial response without waiting for deferred fields to resolve, before streaming patches for each deferred field asynchronously as they complete.

```json
// Initial response
{
  "data": {
    "newsFeed": {
      "stories": [{ "text": "...", "comments": null }],
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
        "text": "..."
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

If an error is thrown within a resolver, they get sent along with its closest deferred parent, and get merged with the `graphQLErrors` array.

<h3 id="defer-loadingstate">Distinguishing between "pending" and "null"</h3>

You may have noticed that deferred fields get returned as null in the initial response. So how can we know which fields are pending so that we can show some loading indicator? To deal with that, Apollo Client now exposes field-level loading information in a new property called loadingState that you can check for in your UI components. The shape of loadingState mirrors that of your data:

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

<h3 id="defer-transport">Transport</h3>

There is no additional set up required to use `@defer`. By default, deferred responses are transmitted using [Multipart HTTP](https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html), which is supported by `apollo-link-http`.

<h3 id="defer-setup">Where can I use @defer?</h3>

- `@defer` can be applied on any `FIELD` of a `Query` operation. It is illegal to use `@defer` on an `INLINE_FRAGMENT` or `FRAGMENT_SPREAD`. 

- Mutations: Not supported.

- Non-Nullable Types: Not allowed and will throw a validation error. This is because deferred fields are returned as `null` in the initial response. Deferring non-nullable types may also lead to unexpected behavior when errors occur, since errors will propagate up to the nearest nullable parent as per the GraphQL spec. We want to avoid letting errors on deferred fields clobber the initial data that was loaded already.

- Nesting: `@defer` can be nested arbitrarily. For example, we can defer a list type, and defer a field on an object in the list. During execution, we ensure that the patch for a parent field will be sent before its children, even if the child object resolves first. This will simplify the logic for merging patches.

- Use in GraphQL fragments: Supported. If there are multiple declarations of a field within the query, **all** of them have to contain `@defer` for the field to be deferred. This could happen if we have use a fragment like this:

  ```graphql
  fragment StoryDetail on Story {
    id
    text
  }
  query {
    newsFeed {
      stories {
        text @defer
        ...StoryDetail
      }
    }
  }
  ```
  In this case, `text` will not be deferred since `@defer` was not applied in the fragment definition.

  A common pattern around fragments is to bind it to a component and reuse them across different parts of your UI. This is why it would be ideal to make sure that the `@defer` behavior of fields in a fragment is not overridden.

<h3 id="defer-performance">Performance Considerations</h3>

`@defer` is one of those features that work best if used in moderation. If it is used too granularly (on many nested fields), the overhead of performing patching and re-rendering could be worse than just waiting for the full query to resolve. Try to limit `@defer` to fields that take a significantly longer time to load. This is super easy to figure out if you have Apollo Engine set up!

<h3 id="defer-servers">Use with other GraphQL servers</h3>

If you are sending queries to a GraphQL server that does not support `@defer`, it is likely that the `@defer` directive is simply ignored, or a GraphQL validation error is thrown.

If you would like to implement a GraphQL server that is able to interoperate with Apollo Client, please look at the documentation [here](https://github.com/apollographql/apollo-server/blob/defer-support/docs/source/defer-support.md).
