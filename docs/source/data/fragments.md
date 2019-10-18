---
title: Using fragments
description: Learn how to use fragments to share fields across queries
---

A [GraphQL fragment](http://graphql.org/learn/queries/#fragments) is a piece of logic that a client can share between multiple queries and mutations.

Here, we declare a `NameParts` fragment that is "`on`" a `Person` type:

```graphql
fragment NameParts on Person {
  firstName
  lastName
}
```

A fragment includes a subset of the fields that are declared for its associated type. In the above example, the `Person` type must declare `firstName` and `lastName` fields for the `NameParts` fragment to be valid.

We can now include the `NameParts` fragment in any number of queries and mutations that refer to `Person` objects, like so:

```graphql
query GetPerson {
  people(id: "7") {
    ...NameParts
    avatar(size: LARGE)
  }
}
```

Based on our `NameParts` definition, the above query is equivalent to:

```graphql
query GetPerson {
  people(id: "7") {
    firstName
    lastName
    avatar(size: LARGE)
  }
}
```

However, if we later change which fields are included in the `NameParts` fragment, we automatically change which fields are included in every operation that _uses_ the `NameParts` fragment. This makes it much easier to keep fields consistent across a set of operations.

## Creating and reusing fragments

Fragments are useful for including an identical set of fields across multiple GraphQL operations. For example, a blog might define several operations related to comments, and each of those operations might need to include the same baseline set of fields from a `Comment` type.

To specify this baseline set of fields, we define a fragment that lists the `Comment` fields that every comment-related operation should include:

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

We assign the fragment to `CommentsPage.fragments.comment` as a convention.

To embed a fragment inside GraphQL operation, prefix its name with three periods (`...`), like so:

```js
const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($postFullName: String!, $commentContent: String!) {
    submitComment(postFullName: $postFullName, commentContent: $commentContent) {
      ...CommentsPageComment
    }
  }
  ${CommentsPage.fragments.comment}
`;

export const COMMENT_QUERY = gql`
  query Comment($postName: String!) {
    entry(postFullName: $postName) {
      comments {
        ...CommentsPageComment
      }
    }
  }
  ${CommentsPage.fragments.comment}
`;
```

## Colocating fragments

The tree-like structure of a GraphQL response resembles the hierarchy of a frontend's rendered components. Because of this similarity, you can use fragments to split queries up _between_ components, so that each component requests exactly the fields that it uses. This helps you make your component logic more succinct.

Consider the following view hierarchy for an app:

```
FeedPage
└── Feed
    └── FeedEntry
        ├── EntryInfo
        └── VoteButtons
```

The `FeedPage` components executes a query to fetch a list of `Entry`s, and each of its _sub_components requires different subfields of each `Entry`.

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
