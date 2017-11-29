---
title: Prefetching data
---

Prefetching is one of the easiest ways to make your application's UI feel a lot faster with Apollo Client. Prefetching simply means loading data into the cache before it needs to be rendered on the screen. Essentially, we want to load all data required for a view as soon as we can guess that a user will navigate to it.

In Apollo Client, prefetching is very simple and can be done by running a component's query before it is rendered. As a simple example, in GitHunt, we use the `withApollo` higher-order component to directly call a `query` as soon as the user hovers over a link to the comments page. With the data prefetched, the comments page renders immediately, and the user often experiences no delay at all:

```js
const FeedEntry = ({ entry, currentUser, onVote, client }) => {
  const repoLink = `/${entry.repository.full_name}`;
  const prefetchComments = (repoFullName) => () => {
    client.query({
      query: COMMENT_QUERY,
      variables: { repoName: repoFullName },
    });
  };

  return (
    <div className="media">
      ...
      <div className="media-body">
        <RepoInfo
          description={entry.repository.description}
          stargazers_count={entry.repository.stargazers_count}
          open_issues_count={entry.repository.open_issues_count}
          created_at={entry.createdAt}
          user_url={entry.postedBy.html_url}
          username={entry.postedBy.login}
        >
          <Link to={repoLink} onMouseOver={prefetchComments(entry.repository.full_name)}>
              View comments ({entry.commentCount})
          </Link>
        </RepoInfo>
      </div>
    </div>
  );
};

const FeedEntryWithApollo = withApollo(FeedEntry);
```

There are a lot of different ways to anticipate that the user will end up needing some data in the UI. In addition to using the hover state, here are some other places you can preload data:

1. The next step of a multi-step wizard immediately
2. The route of a call-to-action button
3. All of the data for a sub-area of the application, to make navigating within that area instant

If you have some other ideas, please send a PR to this article, and maybe add some more code snippets. A special form of prefetching is [store hydration from the server](./server-side-rendering.html#store-rehydration), so you might also consider hydrating more data than is actually needed for the first page load to make other interactions faster.
