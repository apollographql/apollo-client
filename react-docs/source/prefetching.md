---
title: Prefetching data
order: 24
---

One of the easiest ways to make your application's UI feel a lot snappier with Apollo Client is to use prefetching. Prefetching simply means fetching data before it needs to be rendered on the screen, for example by loading all data required for a view as soon as you anticipate that a user will navigate to it.

In Apollo Client, prefetching is very simple and can be done by running a component's query before rendering. GitHunt uses the `withApollo` higher-order component to directly call the `query` method on `client` as soon as the user hovers over a link to the comments page. With the data prefetched, the comments page renders immediately, and the user often experiences no delay at all:

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
