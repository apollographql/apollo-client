---
title: Pagination
order: 105
description: How to continuously fetch more data for a paginated query.
---

Sometimes you need to fetch a rather long list of items from the server but for the performance and user experience sake you want to fetch only 10 items at a time. Later, when the user scrolls through the list, you might want to fetch 10 more, but for the initial request it is paramount to load and display the first 10 items as fast as possible.

Apollo Client has a built in functionality for this behavior, widely known as "infinite scroll", that allows you to load more items as you go.

<h2 id="watch-query">Watch Query</h2>

Start by watching a query with the initial variables set. In our example, we will fetch a list of comments for an entry in the paginated fashion:

```js
const query = client.watchQuery({
  query: gql`
    query Comments($id: Int!, $start: Int, $limit: Int) {
      entry(id: $id) {
        title
        author {
          name
        }

        # this is where the start and limit arguments are used
        comments(start: $start, limit: $limit) {
          author {
            name
          }
          text
        }
      }
    }
  `,
  // only fetch first 10 items
  variables: { start: 0, limit: 10, id: '1' },
});

query.subscribe({
  next(queryResult) {
    // do something with the results of the query
    console.log('result of the query is now:', queryResult);
  }
});
```

Now, since we subscribed to the query's observable, we will receive the initial result of the query.

<h2 id="fetch-more">Fetch more</h2>

Later, let's say the user scrolled past the end of the list and you want to fetch more comments. You can do it using the `fetchMore` method on the query observable and either pass new variables or an entirely new query.

Here is an example of calling `fetchMore` with new variables. The results of the subsequent query would need to be incorporated back into Apollo Store, this can be done by supplying an `updateQuery` function that will merge the previous results and the new data:

```js
query.fetchMore({
  // fetch 10 more items starting from new offset
  // limit and id variables are the same
  variables: { start: 10 },
  // tell Apollo Client how to merge the new results of the query
  updateQuery: (previousResult, { fetchMoreResult, queryVariables }) => {
    const prevEntry = previousResult.entry;
    const newComments = fetchMoreResult.data.entry.comments;
    return {
      title: prevEntry.title,
      author: prevEntry.author,
      comments: [...prevEntry.comments, ...newComments],
    };
  }
});
```

Now, the cached value in the store will contain both old and new comments and the observable subscription will emit a new query result.

<h2 id="fetch-more-new-query">Fetch more with a different query</h2>

You might have noticed that in the previous example we fetched new comments with the same query. Sometimes, you might want to use an entirely different query with a different shape, or a similar query with a smaller payload size. You can do it in Apollo Client using the same `fetchMore` API:

```js
query.fetchMore({
  query: gql`
    query PromotedComments($id: Int!) {
      promotedComments(id: $id) {
        author
        text
      }
    }
  `,
  variables: { id: '1' },
  updateQuery: (previousResult, { fetchMoreResult, queryVariables }) => {
    const prevEntry = previousResult.entry;
    const newComments = fetchMoreResult.data.promotedComments;
    return {
      title: prevEntry.title,
      author: prevEntry.author,
      // put promoted comments in front
      comments: [...newComments, ...prevEntry.comments],
    };
  }
});
```

Again, the result of the watched query will be updated in the store, even when updated with a completely differently shaped query.


<h2 id="cursor-pagination">Cursor-based pagination</h2>

A different common server-side implementation for the "infinite scroll" feature is a cursor-based approach. Every time the clients want to fetch more data, they can optionally pass an id of a cursor they got from the last fetch. If cursor is passed as an argument, it is simple to use with `fetchMore`:

```js
query.fetchMore({
  query: gql`
    query nextComments($cursor_id: String!) {
      nextComments(cursor_id: $cursor_id) {
        cursor
        comments {
          author
          text
        }
      }
    }
  `,
  variables: { cursor_id: cursor },
  updateQuery: (previousResult, { fetchMoreResult, queryVariables }) => {
    const prevEntry = previousResult.entry;
    const newComments = fetchMoreResult.data.comments.nextComments;

    // update cursor
    cursor = fetchMoreResult.data.cursor;

    return {
      title: prevEntry.title,
      author: prevEntry.author,
      // put promoted comments in front
      comments: [...newComments, ...prevEntry.comments],
    };
  }
});
```

<h2 id="merge-function">Merge Function</h2>

The merge function used in the example is acting as a reducer, similar to the reducers in [Redux](http://redux.js.org/docs/basics/Reducers.html).

You don't have to use Redux to understand reducers. All you need to know is that reducer never mutates the arguments and acts as a pure function:
- must return an updated query result that incorporates `fetchMoreResult`
- must avoid mutating the arguments, such that previous query result, and prefer cloning
- should have no side effects

<h3 id="merge-function-options">Options passed to the merge function</h3>

Merge function `updateQuery` takes two arguments: previous result of the query from store and options. Here is a list of options:

- `fetchMoreResult` - result of the `fetchMore` query
- `queryVariables` - variables used on the original query
