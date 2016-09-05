---
title: Optimistic UI
order: 22
---

As explained in the [mutations](mutations.html#optimistic-ui) section, optimistic UI is a pattern that you can use to simulate the results of a mutation and update the UI even before receiving a response from the server. Once the response is received from the server, the actual result is compared to the optimistic result. If the actual result is different from the optimistic one, the optimistic update will automatically be rolled back, and the UI updated with the actual results. Optimistic UI thus provides an easy way to make your UI respond much faster, while still ensuring that the data stays consistent with the server.

<h2 id="optimistic-basics">Basic optimistic UI</h2>

Let's say we have an "edit comment" mutation, and we want the UI to update immediately when the user submits the mutation, instead of waiting for the server response. This is what the `optimisticResponse` parameter to the `mutate` function provides.

The list of comments is not driven by the mutation query, so if we want our optimistic response to update the UI, we have to make sure to return an optimistic response that will end up with the same ID as far as Apollo is concerned (we can control this with the [`dataIdFromObject`](cache-updates.html#dataIdFromObject) option). Otherwise Apollo will not be able to tell that this is a modification to an existing comment, and it will simply insert a new comment into its store without refreshing the original query result (or changing the UI).

Here's what this looks like in the code:

```js

const updateComment = gql`
  mutation updateComment($commentId: ID!, $commentContent: String!) {
    updateComment(commentId: $commentId, commentContent: $commentContent) {
      id
      __typename
      content
    }
  }
`;

const CommentPageWithData = graphql(submitComment, {
  props: ({ ownProps, mutate }) => ({
    submit({ commentId, commentContent }) {
      return mutate({
        variables: { commentId, commentContent },
        optimisticResponse: {
          __typename: 'Mutation',
          updateComment: {
            id: commentId,
            __typename: 'Comment',
            content: commentContent,
          },
        },
      });
    },
  }),
})(CommentPage);
```

We select `id` and `__typename` because that's what we configured `dataIdFromObject` to use to determine a globally unique object ID.

<h2 id="optimistic-advanced">Adding to a list</h2>

In the example above, we showed how to seamlessly edit an existing object in the store with an optimistic mutation result. However, many mutations don't just update an existing object in the store, but they insert a new one.

In that case we need to specify how to integrate the new data into existing queries, and thus our UI. You can read in detail about how to do that in the article about [controlling the store](cache-updates.html)--in particular, we can use the `updateQueries` function to insert a result into an existing query's result set. In this way, `updateQueries` works the same for optimistic results and the actual results returned from the server. It only has to be specified once.

Here is a concrete example from GitHunt, which inserts a comment into an existing list of comments. A very quick and easy way to update the list of comments would be to refetch the entire list from the server every time a comment is inserted, but that would be a bit wasteful. Instead, we can use `updateQueries` here and just insert the new comment into the list of comments we already have in the store:

```js
import React from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';
import update from 'react-addons-update';


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
            Comment: (previousResult, { mutationResult }) => {
              const newComment = mutationResult.data.submitComment;
              return update(previousResult, {
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
