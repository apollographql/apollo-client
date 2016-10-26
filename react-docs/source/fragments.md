---
title: Using Fragments
---

A [GraphQL fragment](http://graphql.org/learn/queries/#fragments) is a shared piece of query logic.

```graphql
fragment NameParts on Person {
  firstName
  lastName
}

query getPerson {
  people(id: "7") {
    ...NameParts
    avatar(size: LARGE)
  }
}
```

There are two principal uses for fragments in Apollo:

  - Sharing logic between multiple queries, mutations or subscriptions.
  - Breaking your queries up to allow you to co-locate field access with the places they are used.

In this document we'll patterns to do both; we'll also make use of a helper package [`graphql-fragments`](https://github.com/apollostack/graphql-fragments) which aims to help us, especially with the second problem.

<h2 id="reusing-fragments">Reusing Fragments</h2>

The most straightforward use of Fragments is to reuse parts of queries (or mutations or subscriptions) in various parts of your application. For instance, in GitHunt on the comments page, we want to fetch the same fields after posting a comment as we originally query. This way we can be sure that we render consistent comment objects as the data changes.

To do so, we can simply share a fragment describing the fields we need for a comment:

```js
import Fragment from 'graphql-fragments';

CommentsPage.fragments = {
  comment: new Fragment(gql`
    fragment CommentsPageComment on Comment {
      id
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  `),
};
```

We put the fragment on `CommentsPage.fragments.comment` by convention, and use the `Fragment` class exported by the `graphql-fragments` package to create it.

> In this case, there's no great advantage in using the `Fragment` class, but (as we'll see an example of in the next section), it makes it easier to nest fragments, so it makes sense to use it in all cases.

When it's time to embed the fragment in a query, we simply use the `...Name` syntax in our GraphQL, and pass the fragment object into our `graphql` HOC:

```
const SUBMIT_COMMENT_MUTATION = gql`
  mutation submitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      ...CommentsPageComment
    }
  }
`;

const withMutations = graphql(SUBMIT_COMMENT_MUTATION, {
  options: { fragments: CommentsPage.fragments.comment.fragments() },
  ...
}

export const COMMENT_QUERY = gql`
  query Comment($repoName: String!) {
    # ...
    entry(repoFullName: $repoName) {
      # ...
      comments {
        ...CommentsPageComment
      }
      # ...
    }
  }
`;

const withData = graphql(COMMENT_QUERY, {
  options({ params }) {
    return {
      fragments: CommentsPage.fragments.comment.fragments(),
```

You can see the full source code to the `CommentsPage` in GitHunt [here](https://github.com/apollostack/GitHunt-React/blob/master/ui/routes/CommentsPage.js).
