---
title: Using fragments
description: Learn how to use fragments to share fields across queries
---

A [GraphQL fragment](http://graphql.org/learn/queries/#fragments) is a shared piece of query logic.

```graphql
fragment NameParts on Person {
  firstName
  lastName
}

query GetPerson {
  people(id: "7") {
    ...NameParts
    avatar(size: LARGE)
  }
}
```

It's important to note that the component after the `on` clause is designated for the type we are selecting from. In this case, `people` is of type `Person` and we want to select the `firstName` and `lastName` fields from `people(id: "7")`.

There are two principal uses for fragments in Apollo:

  - Sharing fields between multiple queries, mutations or subscriptions.
  - Breaking your queries up to allow you to co-locate field access with the places they are used.

In this document we'll outline patterns to do both using the `gql` function.

## Reusing fragments

The most straightforward use of fragments is to reuse parts of queries (or mutations or subscriptions) in various parts of your application. For instance, in GitHunt on the comments page, we want to fetch the same fields after posting a comment as we originally query. This way we can be sure that we render consistent comment objects as the data changes.

To do so, we can simply share a fragment describing the fields we need for a comment:

```js
import { gql } from '@apollo/client';

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

```js
const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($repoFullName: String!, $commentContent: String!) {
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

You can see the full source code to the `CommentsPage` in GitHunt [here](https://github.com/apollographql/GitHunt-React/blob/master/src/routes/CommentsPage.js).

## Colocating fragments

A key advantage of GraphQL is the tree-like nature of the response data, which in many cases mirrors your rendered component hierarchy. This, combined with GraphQL's support for fragments, allows you to split your queries up in such a way that the various fields fetched by the queries are located right alongside the code that uses the field.

Although this technique doesn't always make sense (for instance it's not always the case that the GraphQL schema is driven by the UI requirements), when it does, it's possible to use some patterns in Apollo client to take full advantage of it.

In GitHunt, we show an example of this on the [`FeedPage`](https://github.com/apollographql/GitHunt-React/blob/master/src/routes/FeedPage.js), which constructs the following view hierarchy:

```
FeedPage
└── Feed
    └── FeedEntry
        ├── RepoInfo
        └── VoteButtons
```

The `FeedPage` conducts a query to fetch a list of `Entry`s, and each of the subcomponents requires different subfields of each `Entry`.

### Creating fragments

To create the fragments, we again use the `gql` helper and attach to subfields of `ComponentClass.fragments`, for example:

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

### Importing fragments when using Webpack

When loading `.graphql` files with [graphql-tag/loader](https://github.com/apollographql/graphql-tag/blob/master/loader.js), we can include fragments using `import` statements. For example:

```graphql
#import "./someFragment.graphql"
```

Will make the contents of `someFragment.graphql` available to the current file. See the [Webpack Fragments](/integrations/webpack/#fragments) section for additional details.

## Fragments on unions and interfaces

By default, Apollo Client doesn't require any knowledge of the GraphQL schema, which means it's very easy to set up and works with any server and supports even the largest schemas. However, as your usage of Apollo and GraphQL becomes more sophisticated, you may start using fragments on interfaces or unions. Here's an example of a query that uses fragments on an interface:

```graphql
query {
  all_people {
    ... on Character {
      name
    }
    ... on Jedi {
      side
    }
    ... on Droid {
      model
    }
  }
}
```

In the query above, `all_people` returns a result of type `Character[]`. Both `Jedi` and `Droid` are possible concrete types of `Character`, but on the client there is no way to know that without having some information about the schema. By default, Apollo Client's `InMemoryCache` assumes that a fragment matched if the result included all the fields in the fragment's selection set, and did not match if any field was missing. This heuristic works in most cases, but it also means that Apollo Client cannot check the server response for you, or warn you when you're manually writing invalid data into the store using `update`, `updateQuery`, `writeQuery`, etc. The heuristic is also more likely to be wrong when matching fragments against unions or interfaces.

### Configuring `possibleTypes`

Whereas past versions of Apollo Client used something called an `IntrospectionFragmentMatcher` to match fragments against unions and interfaces, Apollo Client 3.0 takes a simpler approach.

When you create an instance of the `InMemoryCache`, you can pass an option called `possibleTypes`, which maps the names of supertypes to arrays of subtype names:

```ts
const cache = new InMemoryCache({
  possibleTypes: {
    Character: ['Jedi', 'Droid'],
    Test: ["PassingTest", "FailingTest", "SkippedTest"],
    Snake: ["Viper", "Python"],
  },
});
```

In many applications, the code required for this configuration is short enough to write by hand. That's because unions and interfaces are relatively rare compared to other kinds of types in GraphQL schemas, and you can get away with worrying only about the ones your application actually uses as fragment type constraints.

However, new union or interface types might be added to your schema in the future, or your client application could start using more of the ones that already exist, so it's important to have a way of generating the `possibleTypes` configuration automatically from your schema.

### Generating `possibleTypes`

Here's a script you can use to translate an introspection query into the `possibleTypes` configuration object:

```js
const fetch = require('node-fetch');
const fs = require('fs');

fetch(`${YOUR_API_HOST}/graphql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    variables: {},
    query: `
      {
        __schema {
          types {
            kind
            name
            possibleTypes {
              name
            }
          }
        }
      }
    `,
  }),
}).then(result => result.json())
  .then(result => {
    const possibleTypes = {};

    result.data.__schema.types.forEach(supertype => {
      if (supertype.possibleTypes) {
        possibleTypes[supertype.name] =
          supertype.possibleTypes.map(subtype => subtype.name);
      }
    });

    fs.writeFile('./possibleTypes.json', JSON.stringify(possibleTypes), err => {
      if (err) {
        console.error('Error writing possibleTypes.json', err);
      } else {
        console.log('Fragment types successfully extracted!');
      }
    });
  });
```

To use the generated `possibleTypes` information, simply import it from the generated `.json` module:

```ts
import possibleTypes from './path/to/possibleTypes.json';

const cache = new InMemoryCache({
  possibleTypes,
});
```
