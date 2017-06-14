---
title: Updating the Store
---

Apollo performs two important core tasks: Executing queries and mutations, and caching the results.

Thanks to Apollo's store design, it's possible for the results of a query or mutation to update your UI in all the right places. In many cases it's possible for that to happen automatically, whereas in others you need to help the client out a little in doing so.

<h2 id="normalization">Normalization with `dataIdFromObject`</h2>

Apollo does result caching based on two things:

1. The shape of GraphQL queries and their results.
2. The identities of the objects returned from the server.

Flattening out the cache based on object identity is referred to as cache normalization. You can read about our caching model in detail in our blog post, ["GraphQL Concepts Visualized"](https://medium.com/apollo-stack/the-concepts-of-graphql-bc68bd819be3).

By default, Apollo identifies objects based on two properties: The `__typename` and an ID field, either `id` or `_id`. The client automatically adds the `__typename` field to your queries, so you just have to make sure to fetch the `id` field if you have one.

```js
// This result
{
  __typename: 'Person',
  id: '1234',
  name: 'Jonas',
}

// Will get the following ID
'Person:1234'
```

You can also specify a custom function to generate IDs from each object, and supply it as the `dataIdFromObject` in the [`ApolloClient` constructor](initialization.html#creating-client), if you want to specify how Apollo will identify and de-duplicate the objects returned from the server.

```js
import { ApolloClient } from 'react-apollo';

// If your database has unique IDs across all types of objects, you can use
// a very simple function!
const client = new ApolloClient({
  dataIdFromObject: o => o.id
});
```

These IDs allow Apollo Client to reactively tell all queries that fetched a particular object about updates to that part of the store.

If you want to get the dataIdFromObjectFunction (for instance when using the [`readFragment` function](/core/apollo-client-api.html#ApolloClient\.readFragment)), you can access it as `client.dataIdFromObject`.
```js
const person = {
  __typename: 'Person',
  id: '1234',
};

client.dataIdFromObject(person); // 'Person:1234'
```

<h3 id="automatic-updates">Automatic store updates</h3>

Let's look at a case where just using the cache normalization results in the correct update to our store. Let's say we do the following query:

```graphql
{
  post(id: '5') {
    id
    score
  }
}
```

Then, we do the following mutation:

```graphql
mutation {
  upvotePost(id: '5') {
    id
    score
  }
}
```

If the `id` field on both results matches up, then the `score` field everywhere in our UI will be updated automatically! One nice way to take advantage of this property as much as possible is to make your mutation results have all of the data necessary to update the queries previously fetched. A simple trick for this is to use [fragments](fragments.html) to share fields between the query and the mutation that affects it.

<h2 id="after-mutations">Updating after a mutation</h2>

In some cases, just using `dataIdFromObject` is not enough for your application UI to update correctly. For example, if you want to add something to a list of objects without refetching the entire list, or if there are some objects that to which you can't assign an object identifier, Apollo Client cannot update existing queries for you. Read on to learn about the other tools at your disposal.

<h3 id="refetchQueries">`refetchQueries`</h3>

`refetchQueries` is the simplest way of updating the cache. With `refetchQueries` you can specify one or more queries that you want to run after a mutation is completed in order to refetch the parts of the store that may have been affected by the mutation:

```javascript
mutate({
  //... insert comment mutation
  refetchQueries: [{
    query: gql`
      query updateCache($repoName: String!) {
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
      }
    `,
    variables: { repoFullName: 'apollographql/apollo-client' },
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
    variables: { repoFullName: 'apollographql/apollo-client' },
  }],
})
```


<h3 id="directAccess">`update`</h3>

Using `update` gives you full control over the cache, allowing you to make changes to your data model in response to a mutation in any way you like. `update` is the recommended way of updating the cache after a query. It is explained in full [here](http://dev.apollodata.com/react/api-mutations.html#graphql-mutation-options-update).

```javascript
import CommentAppQuery from '../queries/CommentAppQuery';

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
`;

const CommentsPageWithMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  props({ ownProps, mutate }) {
    return {
      submit({ repoFullName, commentContent }) {
        return mutate({
          variables: { repoFullName, commentContent },

          update: (store, { data: { submitComment } }) => {
            // Read the data from our cache for this query.
            const data = store.readQuery({ query: CommentAppQuery });
            // Add our comment from the mutation to the end.
            data.comments.push(submitComment);
            // Write our data back to the cache.
            store.writeQuery({ query: CommentAppQuery, data });
          },
        });
      },
    };
  },
})(CommentsPage);
```

<h3 id="updateQueries">`updateQueries`</h3>

**NOTE: We recommend using the more flexible `update` API instead of `updateQueries`. The `updateQueries` API may be deprecated in the future.**

As its name suggests, `updateQueries` lets you update your UI based on the result of a mutation. To re-emphasize: most of the time, your UI will update automatically based on mutation results, as long as the object IDs in the result match up with the IDs you already have in your store. See the [`normalization`](#normalization) documentation above for more information about how to take advantage of this feature.

However, if you are removing or adding items to a list with a mutation or can't assign object identifiers to the relevant objects, you'll have to use `updateQueries` to make sure that your UI reflects the change correctly.

We'll take the comments page within GitHunt as our example. When we submit a new comment, the "submit" button fires a mutation which adds a new comment to the "list" of the comments held on the server. In reality, the server doesn't know there's a list--it just knows that something is added to the `comments` table in SQL--so the server can't really tell us exactly where to put the result. The original query that fetched the comments for the list also doesn't know about this new comment yet, so Apollo can't automatically add it to the list for us.

In this case, we can use `updateQueries` to make sure that query result is updated, which will also update Apollo's normalized store to make everything remain consistent.

If you're familiar with Redux, think of the `updateQueries` option as a reducer, except instead of updating the store directly we're updating the query result shape, which means we don't have to worry about how the store internals work.

We expose this mutation through a function prop that the `CommentsPage` component can call. This is what the code looks like:

```javascript
import update from 'immutability-helper';

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
`;

const CommentsPageWithMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  props({ ownProps, mutate }) {
    return {
      submit({ repoFullName, commentContent }) {
        return mutate({
          variables: { repoFullName, commentContent },

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

In our `updateQueries` function for the `Comment` query, we're doing something really simple: just adding the comment we just submitted to the list of comments that the query asks for. We're doing that using the `update` function from the [immutability-helper](https://github.com/kolodny/immutability-helper) package, just to do it concisely. But, if you wanted to, you could write some no-helper Javascript to combine the two incoming objects into a new one for the result.

Once the mutation fires and the result arrives from the server (or, a result is provided through optimistic UI), our `updateQueries` function for the `Comment` query will be called and the `Comment` query will be updated accordingly. These changes in the result will be mapped to React props and our UI will update as well with the new information!

<h3 id="resultReducers">Query `reducer`</h3>

**NOTE: We recommend using the more flexible `update` API instead of `reducer`. The `reducer` API may be deprecated in the future.**

While `updateQueries` and `update` can only be used to update other queries based on the result of a mutation, the `reducer` option is a way that lets you update the query result based on any Apollo action, including results of other queries, mutations or subscriptions. It acts just like a Redux reducer on the denormalized query result:

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
          // Those can be found on the `action` argument.

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

As you can see, the `reducer` option can be used to achieve the same goal as `updateQueries`, but it is more flexible and works with any type of Apollo action, not just mutations. For example, the query result can be updated based on another query's result.

> It is not currently possible to respond to your custom Redux actions arriving from outside of Apollo in a result reducer. See [this thread](https://github.com/apollographql/apollo-client/issues/1013) for more information.

**When should you use update vs. reducer vs. updateQueries vs. refetchQueries?**

`refetchQueries` should be used whenever the mutation result alone is not enough to infer all the changes to the cache. `refetchQueries` is also a very good option if an extra roundtrip and possible overfetching are not of concern for your application, which is often true during prototyping. Compared with `update`, `updateQueries` and `reducer`, `refetchQueries` is the easiest to write and maintain.

`updateQueries`, `reducer` and `update` all provide similar functionality. They were introduced in that order and each tried to address shortcomings in the previous one. While all three APIs are currently available, we strongly recommend using `update` wherever possible, as the other two APIs (`updateQueries` and `reducer`) may be deprecated in the future. We recommend `update` because its API is both the most powerful and easiest to understand of all three. The reason we are considering deprecating `reducer` and `updateQueries` is that they both depend on state internal to the client, which makes them harder to understand and maintain than `update`, without providing any extra functionality.


<h2 id="fetchMore">Incremental loading: `fetchMore`</h2>

`fetchMore` can be used to update the result of a query based on the data returned by another query. Most often, it is used to handle infinite-scroll pagination or other situations where you are loading more data when you already have some.

In our GitHunt example, we have a paginated feed that displays a list of GitHub repositories. When we hit the "Load More" button, we don't want Apollo Client to throw away the repository information it has already loaded. Instead, it should just append the newly loaded repositories to the list that Apollo Client already has in the store. With this update, our UI component should re-render and show us all of the available repositories.

Let's see how to do that with the `fetchMore` method on a query:

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

          updateQuery: (previousResult, { fetchMoreResult }) => {
            if (!fetchMoreResult) { return previousResult; }

            return Object.assign({}, previousResult, {
              feed: [...previousResult.feed, ...fetchMoreResult.feed],
            });
          },
        });
      },
    };
  },
})(Feed);
```

We have two components here: `FeedWithData` and `Feed`. The `FeedWithData` container implementation produces the `props` to be passed to the presentational `Feed` component. Specifically, we're mapping the `loadNextPage` prop to the following:

```js
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

It can also take a `query` named argument, which can be a GraphQL document containing a query that will be fetched in order to fetch more information; we refer to this as the `fetchMore` query. By default, the `fetchMore` query is the query associated with the container, in this case the `FEED_QUERY`.

When we call `fetchMore`, Apollo Client will fire the `fetchMore` query and use the logic in the `updateQuery` option to incorporate that into the original result. The named argument `updateQuery` should be a function that takes the previous result of the query associated with your component (i.e. `FEED_QUERY` in this case) and the information returned by the `fetchMore` query and return a combination of the two.

Here, the `fetchMore` query is the same as the query associated with the component. Our `updateQuery` takes the new feed items returned and just appends them onto the feed items that we'd asked for previously. With this, the UI will update and the feed will contain the next page of items!

Although `fetchMore` is often used for pagination, there are many other cases in which it is applicable. For example, suppose you have a list of items (say, a collaborative todo list) and you have a way to fetch items that have been updated after a certain time. Then, you don't have to refetch the whole todo list to get updates: you can just incorporate the newly added items with `fetchMore`, as long as your `updateQuery` function correctly merges the new results.

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

Apollo Client will use the return value of the custom resolver to look up the item in its cache. `toIdValue` must be used to indicate that the value returned should be interpreted as an id, and not as a scalar value or an object. "Query" key in this example is your root query type name.

It is also possible to return a list of IDs:

```
customResolvers: {
  Query: {
    books: (_, args) => args['ids'].map(id =>
      toIdValue(dataIdFromObject({ __typename: 'book', id: id }))),
  },
},
```
