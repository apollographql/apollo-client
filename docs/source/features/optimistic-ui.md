---
title: Optimistic UI
---

As explained in the [mutations](/docs/react/basics/mutations.html#optimistic-ui) section, optimistic UI is a pattern that you can use to simulate the results of a mutation and update the UI even before receiving a response from the server. Once the response is received from the server, the optimistic result is thrown away and replaced with the actual result.

Optimistic UI provides an easy way to make your UI respond much faster, while ensuring that the data becomes consistent with the actual response when it arrives.

<h2 id="optimistic-basics">Basic optimistic UI</h2>

Let's say we have an "edit comment" mutation, and we want the UI to update immediately when the user submits the mutation, instead of waiting for the server response. This is what the `optimisticResponse` parameter to the `mutate` function provides.

The main way to get GraphQL data into your UI components with Apollo is to use a query, so if we want our optimistic response to update the UI, we have to make sure to return an optimistic response that will update the correct query result. Learn more about how to do this with the [`dataIdFromObject`](../advanced/caching.html#normalization) option.

Here's what this looks like in the code:

```js
const UPDATE_COMMENT = gql`
  mutation UpdateComment($commentId: ID!, $commentContent: String!) {
    updateComment(commentId: $commentId, commentContent: $commentContent) {
      id
      __typename
      content
    }
  }
`;
const CommentPageWithData = () => (
  <Mutation mutation={UPDATE_COMMENT}>
    {mutate => {
      <Comment
        updateComment={({ commentId, commentContent }) =>
          mutate({
            variables: { commentId, commentContent },
            optimisticResponse: {
              __typename: "Mutation",
              updateComment: {
                id: commentId,
                __typename: "Comment",
                content: commentContent
              }
            }
          })
        }
      />;
    }}
  </Mutation>
);
```

We select `id` and `__typename` because that's what our `dataIdFromObject` uses to determine a globally unique object ID. We need to make sure to provide the right values for those fields, so that Apollo knows what object we are referring to.

<h2 id="optimistic-advanced">Adding to a list</h2>

In the example above, we showed how to seamlessly edit an existing object in the store with an optimistic mutation result. However, many mutations don't just update an existing object in the store, but they insert a new one.

In that case we need to specify how to integrate the new data into existing queries, and thus our UI. You can read in detail about how to do that in the article about [controlling the store](../advanced/caching.html)--in particular, we can use the `update` function to insert a result into an existing query's result set. `update` works exactly the same way for optimistic results and the real results returned from the server.

Here is a concrete example from GitHunt, which inserts a comment into an existing list of comments.

```js
const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(
      repoFullName: $repoFullName
      commentContent: $commentContent
    ) {
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  }
`;

const CommentsPageWithMutations = ({ currentUser }) => (
  <Mutation mutation={SUBMIT_COMMENT_MUTATION}>
    {mutate => (
      <CommentsPage
        submit={(repoFullName, commentContent) =>
          mutate({
            variables: { repoFullName, commentContent },
            optimisticResponse: {
              __typename: "Mutation",
              submitComment: {
                __typename: "Comment",
                postedBy: currentUser,
                createdAt: new Date(),
                content: commentContent
              }
            },
            update: (proxy, { data: { submitComment } }) => {
              // Read the data from our cache for this query.
              const data = proxy.readQuery({ query: CommentAppQuery });
              // Add our comment from the mutation to the end.
              data.comments.push(submitComment);
              // Write our data back to the cache.
              proxy.writeQuery({ query: CommentAppQuery, data });
            }
          })
        }
      />
    )}
  </Mutation>
);
```
