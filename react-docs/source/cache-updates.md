---
title: Controlling the Store
---

Apollo performs two important core tasks: executing queries and mutations, and caching the results.

Thanks to Apollo's store, it's possible for the results of a query or mutation to update your UI in all the right places. In many cases it's possible for that to happen automatically, whereas in others you need to help the client out a little in doing so.

<h2 id="dataIdFromObject">Normalization with `dataIdFromObject`</h2>

While Apollo can do basic caching based on the shape of GraphQL queries and their results, Apollo won't be able to associate objects fetched by different queries without additional information about the identities of the objects returned from the server. This is referred to as [cache normalization](http://dev.apollodata.com/core/how-it-works.html#normalize). You can read about our caching model in detail in our blog post, ["GraphQL Concepts Visualized"](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3).

By default, Apollo does not use object IDs at all, doing caching based only on the path to the object from the root query. However, if you specify a function to generate IDs from each object, and supply it as the `dataIdFromObject` in the [`ApolloClient` constructor](initialization.html#creating-client), you can decide how Apollo will identify and de-duplicate the objects returned from the server.

```js
import { ApolloClient } from 'react-apollo';

// If your database has unique IDs across all types of objects, you can use
// a very simple function!
// Remember: You'll need to ensure that you select IDs in every query where
// you need the results to be normalized.
const client = new ApolloClient({
  dataIdFromObject: o => o.id
});

// If the IDs are only unique per type (this is typical if an ID is just an
// ID out of a database table), you can use the `__typename` field to scope it.
// This is a GraphQL field that's automatically available, but you do need
// to query for it also.
const client = new ApolloClient({
  dataIdFromObject: (result) => {
    if (result.id && result.__typename) {
      return result.__typename + result.id;
    }

    // Make sure to return null if this object doesn't have an ID
    return null;
  },
});
```

These IDs allow Apollo Client to reactively tell all queries that fetched a particular object about updates to that part of the store.

So to do `dataIdFromObject` most concisely, your client initialization might look like this:

```
import { ApolloClient, createNetworkInterface } from 'react-apollo'

const networkInterface = createNetworkInterface('http://localhost:3000/graphql') // TBD: Need to provide the right path for production

const apolloClient = new ApolloClient({
    networkInterface: networkInterface,
    addTypename: true,
    dataIdFromObject: (result) => {
        if (result.id && result.__typename) {
            return result.__typename + result.id
        }
        return null
    }
})
```

In some cases, just using `dataIdFromObject` is not enough for your application UI to update correctly. For example, if you want to add something to a list of objects without refetching the entire list, or if there are some objects that to which you can't assign an object identifier, Apollo Client cannot update existing queries for you.

In those cases you have to use other features like `fetchMore` or the other methods listed on this page in order to make sure that your queries are updated with the right information and your UI updates correctly.

<h2 id="cacheRedirect">Cache redirects with `customResolvers`</h2>

In some cases, a query requests data that already exists in the client store under a different key. A very common example of this is when your UI has a list view and a detail view that both use the same data. The list view might run the following query:

```
query ListView {
  books {
    id
    title
    abstract
  }
}
```

When a specific book is selected, the detail view displays an individual item using this query:

```
query DetailView {
  book(id: $id) {
    id
    title
    abstract
  }
}
```

We know that the data is most likely already in the client cache, but because it's requested with a different query, Apollo Client doesn't know that. In order to tell Apollo Client where to look for the data, we can define custom resolvers:

```
import ApolloClient, { toIdValue } from 'apollo-client';

const client = new ApolloClient({
      networkInterface,
      customResolvers: {
        Query: {
          book: (_, args) => toIdValue(dataIdFromObject({ __typename: 'book', id: args['id'] })),
        },
      },
      dataIdFromObject,
    });
```

Apollo Client will use the return value of the custom resolver to look up the item in its cache. `toIdValue` must be used to indicate that the value returned should be interpreted as an id, and not as a scalar value or an object.

It is also possible to return a list of ids:
```
customResolvers: {
  Query: {
    books: (_, args) => args['ids'].map(id => toIdValue(dataIdFromObject({ __typename: 'book', id: id }))),
  },
},
```

<h2 id="fetchMore">Using `fetchMore`</h2>

`fetchMore` can be used to manually update the result of one query based on the data returned by another query. Most often, it is used to handle pagination. In our GitHunt example, we have a paginated feed that displays a list of GitHub respositories. When we hit the "Load More" button, we don't want Apollo Client to throw away the repository information it has already loaded. Instead, it should just append the newly loaded repositories to the list that Apollo Client already has in the store. With this update, our UI component should re-render and show us all of the available repositories.

This is possible with `fetchMore`. The `fetchMore` method allows us to fetch another query and incorporate that query's result into the result of one existing query. We can see it in action within the [GitHunt](https://github.com/apollostack/GitHunt-React) code:

```javascript
const FeedQuery = gql`
  query Feed($type: FeedType!, $offset: Int, $limit: Int) {
    # ...
  }`;

const FeedWithData = graphql(FeedQuery, {
  props({ data: { loading, feed, currentUser, fetchMore } }) {
    return {
      loading,
      feed,
      currentUser,
      loadNextPage() {
        return fetchMore({
          variables: {
            offset: feed.length,
          },
          updateQuery: (prev, { fetchMoreResult }) => {
            if (!fetchMoreResult.data) { return prev; }
            return Object.assign({}, prev, {
              feed: [...prev.feed, ...fetchMoreResult.feed],
            });
          },
        });
      },
    };
  },
})(Feed);
```

We have two components here: `FeedWithData` and `Feed`. The `FeedWithData` implementation produces the `props` to be passed to the `Feed` component which serves as the presentation layer, i.e. it produces the UI. Specifically, we're mapping the `loadNextPage` prop to the following:

```
return fetchMore({
  variables: {
    offset: feed.length,
  },
  updateQuery: (prev, { fetchMoreResult }) => {
    if (!fetchMoreResult.data) { return prev; }
    return Object.assign({}, prev, {
      feed: [...prev.feed, ...fetchMoreResult.feed],
    });
  },
});
```

The `fetchMore` method takes a map of `variables` to be sent with the new query. Here, we're setting the offset to `feed.length` so that we fetch items that aren't already displayed on the feed. This variable map is merged with the one that's been specified for the query associated with the component. This means that other variables, e.g. the `limit` variable, will have the same value as they do within the component query.

It can also take a `query` named argument, which can be a GraphQL document containing a query that will be fetched in order to fetch more information; we refer to this as the `fetchMore` query. By default, the `fetchMore` query is the query associated with the component, i.e. the `FEED_QUERY` in this case.

When we call `fetchMore`, Apollo Client will fire the `fetchMore` query and it needs to know how to incorporate the result of the query into the information the component is asking for. This is accomplished through `updateQuery`. The named argument `updateQuery` should be a function that takes the previous result of the query associated with your component (i.e. `FEED_QUERY` in this case) and the information returned by the `fetchMore` query and combine the two.

Here, the `fetchMore` query is the same as the query associated with the component. Our `updateQuery` takes the new feed items returned and just appends them onto the feed items that we'd asked for previously. With this, the UI will update and the feed will contain the next page of items!

Although `fetchMore` is often used for pagination, there are many other cases in which it is applicable. For example, suppose you have a list of items (say, a collaborative todo list) and you have a way to fetch items that have been updated after a certain time. Then, you don't have to refetch the whole todo list to get updates: you can just incorporate the newly added items with `fetchMore`, as long as your `updateQuery` function correctly merges the new results.

<h2 id="updateQueries">Using `updateQueries`</h2>

Just as `fetchMore` allows you to update your UI according to the result of a query, `updateQueries` lets you update your UI based on the result of a mutation. To re-emphasize: most of the time, your UI will update automatically based on mutation results, as long as the object IDs in the result match up with the IDs you already have in your store. See the [`dataIdFromObject`](#dataIdFromObject) documentation above for more information about how to take advantage of this feature.

However, if you are removing or adding items to a list with a mutation or can't assign object identifiers to some of your objects, you'll have to use `updateQueries` to make sure that your UI reflects the change correctly.

We'll take the comments page within GitHunt as our example. When we submit a new comment, the "submit" button fires a mutation which adds a new comment to the "list" of the comments held on the server (in reality, the server doesn't know there's a list--it just knows that something is added to the `comments` table in SQL). The original query that fetched the comments for the list doesn't know about this new comment yet, so Apollo can't automatically add it to the list for us. So we'll use `updateQueries` to make sure that query result is updated, which will update Apollo's normalized store.

If you're familiar with Redux, think of the `updateQueries` option as a reducer, except instead of updating the store directly we're updating the query result shape, which means we don't have to worry about how the store internals work.

We expose this mutation through a function prop that the `CommentsPage` component can call. This is what the code looks like:

```javascript
const SUBMIT_COMMENT_MUTATION = gql`
  mutation submitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`
const CommentsPageWithMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  props({ ownProps, mutate }) {
    return {
      submit({ repoFullName, commentContent }) {
        return mutate({
          variables: { repoFullName, commentContent },
          optimisticResponse: {
            __typename: 'Mutation',
            submitComment: {
              __typename: 'Comment',
              postedBy: ownProps.currentUser,
              createdAt: +new Date,
              content: commentContent,
            },
          },
          updateQueries: {
            Comment: (prev, { mutationResult }) => {
              const newComment = mutationResult.data.submitComment;
              return update(prev, {
                entry: {
                  comments: {
                    $unshift: [newComment],
                  },
                },
              });
            },
          },
        });
      },
    };
  },
})(CommentsPage);
```

If we were to look carefully at the server schema, we'd see that the mutation actually returns information about the single new comment that was added; it doesn't refetch the whole list of comments. This makes a lot of sense: if we have a thousand comments on a page, we don't want to refetch all of them if we add a single new comment.

The comments page itself is rendered with the following query:

```javascript
const COMMENT_QUERY = gql`
  query Comment($repoName: String!) {
    currentUser {
      login
      html_url
    }

    entry(repoFullName: $repoName) {
      id
      postedBy {
        login
        html_url
      }
      createdAt
      comments {
        postedBy {
          login
          html_url
        }
        createdAt
        content
      }
      repository {
        full_name
        html_url
        description
        open_issues_count
        stargazers_count
      }
    }
  }`;
```

Now, we have to incorporate the newly added comment returned by the mutation into the information that was already returned by the `COMMENT_QUERY` that was fired when the page was loaded. We accomplish this through `updateQueries`. Zooming in on that portion of the code:

```javascript
mutate({
  //...
  updateQueries: {
    Comment: (prev, { mutationResult }) => {
      const newComment = mutationResult.data.submitComment;
      return update(prev, {
        entry: {
          comments: {
            $unshift: [newComment],
          },
        },
      });
    },
  },
})
```

Fundamentally, `updateQueries` is a map going from the name of a query (in our case, `Comment`) to a function that receives the previous result that this query received as well as the result returned by the mutation. In our case, the mutation returns information about the new comment. This function should then incorporate the mutation result into a new object containing the result previously received by the query (`prev`) and return that new object.

Note that the function must not alter the `prev` object (because `prev` is compared with the new object returned to see what changes the function made and hence what prop updates are needed).

In our `updateQueries` function for the `Comment` query, we're doing something really simple: just adding the comment we just submitted to the list of comments that the query asks for. We're doing that using the `update` function from the `immutability-helper` package, just to do it concisely. But, if you wanted to, you could write some no-helper Javascript to combine the two incoming objects into a new one for the result.

Once the mutation fires and the result arrives from the server (or, a result is provided through optimistic UI), our `updateQueries` function for the `Comment` query will be called and the `Comment` query will be updated accordingly. These changes in the result will be mapped to React props and our UI will update as well with the new information!


<h2 id="refetchQueries">Using `refetchQueries`</h2>

`refetchQueries` offers an even simpler way of updating the cache than `updateQueries`. With `refetchQueries` you can specify one or more queries that you want to run after a mutation completed in order to refetch the parts of the store that may have been affected by the mutation:

```javascript
mutate({
  //... insert comment mutation
  refetchQueries: [{
    query: gql`query updateCache {
      entry(repoFullName: $repoName) {
        id
        comments {
          postedBy {
            login
            html_url
          }
          createdAt
          content
        }
      }
    }`,
    variables: { repoFullName: 'apollostack/apollo-client' },
  }],
})
```

A very common way of using `refetchQueries` is to import queries defined for other components to make sure that those components will be updated:

```javascript
import RepoCommentsQuery from '../queries/RepoCommentsQuery';

mutate({
  //... insert comment mutation
  refetchQueries: [{
    query: RepoCommentsQuery,
    variables: { repoFullName: 'apollostack/apollo-client' },
  }],
})
```



<h2 id="resultReducers">Using `reducer`</h2>

While `updateQueries` can only be used to update other queries based on the result of a mutation, the `reducer` option is a way that lets you update the query result based on any **apollo** action, including results of other queries or mutations. It acts just like a Redux reducer on the non-normalized query result:

```javascript
import update from 'immutability-helper';

const CommentsPageWithData = graphql(CommentsPageQuery, {
  props({ data }) {
    // ...
  },
  options({ params }) {
    return {
      reducer: (previousResult, action, variables) => {
        if (action.type === 'APOLLO_MUTATION_RESULT' && action.operationName === 'submitComment'){
          // NOTE: some more sanity checks are usually recommended here to make
          // sure the previousResult is not empty and that the mutation results
          // contains the data we expect.

          // NOTE: variables contains the current query variables,
          // not the variables of the query or mutation that caused the action.

          return update(previousResult, {
            entry: {
              comments: {
                $unshift: [action.result.data.submitComment],
              },
            },
          });
        }
        return previousResult;
      },
    };
  },
})(CommentsPage);
```

As you can see, the `reducer` option can be used to achieve the same goal as `updateQueries`, but it is more flexible and works with any type of **apollo** action, not just mutations. For example, the query result can be updated based on another query's result.

*Note:* It is not currently possible to respond to actions arriving from outside of Apollo (e.g. your custom Redux actions) in a result reducer. See [this thread](https://github.com/apollographql/apollo-client/issues/1013) for more information.


**When should you use reducer vs. updateQueries vs. refetchQueries?**

`refetchQueries` should be used whenever the mutation result alone is not enough to infer all the changes to the cache. `refetchQueries` is also a very good option if an extra roundtrip and possible overfetching are not of concern for your application, which is often true during prototyping. Compared with `updateQueries` and `reducer`, `refetchQueries` is the easiest to write and maintain.

`reducer` and `updateQueries` both provide similar functionality. While `reducer` is more flexible, updates based on mutations can usually be done equally well with `updateQueries`.

The main difference between the two is where the update behavior is declared. With `reducer`, the update behavior is co-located with the query itself. That means the query needs to know what actions should lead to an updated result. With `updateQueries` it is the mutation's responsibility to update all the queries that may need to know about the results of this mutation.

We recommend using the `reducer` option, except when there's a good reason to use `updateQueries` instead (eg. if it would make your app much easier to understand and maintain).
