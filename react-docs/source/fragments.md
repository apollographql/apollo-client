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

  - Sharing fields between multiple queries, mutations or subscriptions.
  - Breaking your queries up to allow you to co-locate field access with the places they are used.

In this document we'll outline patterns to do both; we'll also make use of utilities in the [`graphql-anywhere`](https://github.com/apollographql/graphql-anywhere) and [`graphql-tag`](https://github.com/apollographql/graphql-tag) packages which aim to help us, especially with the second problem.

<h2 id="reusing-fragments">Reusing Fragments</h2>

The most straightforward use of fragments is to reuse parts of queries (or mutations or subscriptions) in various parts of your application. For instance, in GitHunt on the comments page, we want to fetch the same fields after posting a comment as we originally query. This way we can be sure that we render consistent comment objects as the data changes.

To do so, we can simply share a fragment describing the fields we need for a comment:

```js
import { gql } from 'react-apollo';

CommentsPage.fragments = {
  comment: gql`
    fragment CommentsPageComment on Comment {
      id
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  `,
};
```

We put the fragment on `CommentsPage.fragments.comment` by convention, and use the familiar `gql` helper to create it.

When it's time to embed the fragment in a query, we simply use the `...Name` syntax in our GraphQL, and embed the fragment inside our query GraphQL document:

```
const SUBMIT_COMMENT_MUTATION = gql`
  mutation submitComment($repoFullName: String!, $commentContent: String!) {
    submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
      ...CommentsPageComment
    }
  }
  ${CommentsPage.fragments.comment}
`;

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
  ${CommentsPage.fragments.comment}
`;
```

You can see the full source code to the `CommentsPage` in GitHunt [here](https://github.com/apollographql/GitHunt-React/blob/master/ui/routes/CommentsPage.js).

<h2 id="colocating-fragments">Colocating Fragments</h2>

A key advantage of GraphQL is the tree-like nature of the response data, which in many cases mirrors your rendered component hierarchy. This, combined with GraphQL's support for fragments, allows you to split your queries up in such a way that the various fields fetched by the queries are located right alongside the code that uses the field.

Although this technique doesn't always make sense (for instance it's not always the case that the GraphQL schema is driven by the UI requirements), when it does, it's possible to use some patterns in Apollo client to take full advantage of it.

In GitHunt, we show an example of this on the [`FeedPage`](https://github.com/apollographql/GitHunt-React/blob/master/ui/routes/FeedPage.js), which constructs the follow view hierarchy:

```
FeedPage
└── Feed
    └── FeedEntry
        ├── RepoInfo
        └── VoteButtons
```

The `FeedPage` conducts a query to fetch a list of `Entry`s, and each of the subcomponents requires different subfields of each `Entry`.

The `graphql-anywhere` package gives us tools to easily construct a single query that provides all the fields that each subcomponent needs, and allows to easily pass the exact field that a component needs to it.

<h3 id="creating-fragments">Creating Fragments</h3>

To create the fragments, we again use the `gql` helper and attach to subfields of `ComponentClass.fragment`, for example:

```js
VoteButtons.fragments = {
  entry: gql`
    fragment VoteButtons on Entry {
      score
      vote {
        vote_value
      }
    }
  `,
};
```

One nice tool that the `graphql-anywhere` package gives us is a [`PropType`](https://facebook.github.io/react/docs/reusable-components.html) checker that we can use to ensure that we do indeed receive those fields in the component's `entry` prop:

```js
import { propType } from 'graphql-anywhere';

VoteButtons.propTypes = {
  // ...
  entry: propType(VoteButtons.fragments.entry).isRequired,
};
```

If our fragments include sub-fragments then we can pass them into the `gql` helper:

```js
FeedEntry.fragments = {
  entry: gql`
    fragment FeedEntry on Entry {
      commentCount
      repository {
        full_name
        html_url
        owner {
          avatar_url
        }
      }
      ...VoteButtons
      ...RepoInfo
    }
    ${VoteButtons.fragments.entry}
    ${RepoInfo.fragments.entry}
  `,
};
```

<h3 id="filtering-with-fragments">Filtering With Fragments</h3>

We can also use the `graphql-anywhere` package to filter the exact fields from the `entry` before passing them to the subcomponent. So when we render a `VoteButtons`, we can simply do:

```jsx
import { filter } from 'graphql-anywhere';

<VoteButtons
  entry={filter(VoteButtons.fragments.entry, entry)}
  canVote={loggedIn}
  onVote={type => onVote({
    repoFullName: full_name,
    type,
  })}
/>
```

The `filter()` function will grab exactly the fields from the `entry` that the fragment defines.
