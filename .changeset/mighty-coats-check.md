---
"@apollo/client": minor
---

Allow returning `IGNORE` sentinel object from `optimisticResponse` functions to bail-out from the optimistic update.

Consider this example:

```jsx
const UPDATE_COMMENT = gql`
  mutation UpdateComment($commentId: ID!, $commentContent: String!) {
    updateComment(commentId: $commentId, content: $commentContent) {
      id
      __typename
      content
    }
  }
`;

function CommentPageWithData() {
  const [mutate] = useMutation(UPDATE_COMMENT);
  return (
    <Comment
      updateComment={({ commentId, commentContent }) =>
        mutate({
          variables: { commentId, commentContent },
          optimisticResponse: (vars, { IGNORE }) => {
            if (commentContent === "foo") {
            // conditionally bail out of optimistic updates
              return IGNORE;
            }
            return {
              updateComment: {
                id: commentId,
                __typename: "Comment",
                content: commentContent
              }
            }
          },
        })
      }
    />
  );
}
```

The `IGNORE` sentinel can be destructured from the second parameter in the callback function signature passed to `optimisticResponse`.
