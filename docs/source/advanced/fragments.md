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

In this document we'll outline patterns to do both; we'll also make use of utilities in the [`graphql-anywhere`](https://github.com/apollographql/apollo-client/tree/master/packages/graphql-anywhere) and [`graphql-tag`](https://github.com/apollographql/graphql-tag) packages which aim to help us, especially with the second problem.

## Reusing fragments

The most straightforward use of fragments is to reuse parts of queries (or mutations or subscriptions) in various parts of your application. For instance, in GitHunt on the comments page, we want to fetch the same fields after posting a comment as we originally query. This way we can be sure that we render consistent comment objects as the data changes.

To do so, we can simply share a fragment describing the fields we need for a comment:

```js
import gql from 'graphql-tag';

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

In GitHunt, we show an example of this on the [`FeedPage`](https://github.com/apollographql/GitHunt-React/blob/master/src/routes/FeedPage.js), which constructs the follow view hierarchy:

```
FeedPage
└── Feed
    └── FeedEntry
        ├── RepoInfo
        └── VoteButtons
```

The `FeedPage` conducts a query to fetch a list of `Entry`s, and each of the subcomponents requires different subfields of each `Entry`.

The `graphql-anywhere` package gives us tools to easily construct a single query that provides all the fields that each subcomponent needs, and allows to easily pass the exact field that a component needs to it.

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

### Filtering with fragments

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

### Importing fragments when using Webpack

When loading `.graphql` files with [graphql-tag/loader](https://github.com/apollographql/graphql-tag/blob/master/loader.js), we can include fragments using `import` statements. For example:

```graphql
#import "./someFragment.graphql"
```

Will make the contents of `someFragment.graphql` available to the current file. See the [Webpack Fragments](/recipes/webpack/#fragments) section for additional details.

## Fragments on unions and interfaces

> This is an advanced feature that Apollo Boost does not support. Learn how to set Apollo Client up manually in our [Apollo Boost migration guide](/advanced/boost-migration/).

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

In the query above, `all_people` returns a result of type `Character[]`. Both `Jedi` and `Droid` are possible concrete types of `Character`, but on the client there is no way to know that without having some information about the schema. By default, Apollo Client's cache will use a heuristic fragment matcher, which assumes that a fragment matched if the result included all the fields in its selection set, and didn't match when any field was missing. This works in most cases, but it also means that Apollo Client cannot check the server response for you, and it cannot tell you when you're manually writing invalid data into the store using `update`, `updateQuery`, `writeQuery`, etc. Also, the hueristic fragment matcher will not work accurately when using fragments with unions or interfaces. Apollo Client will let you know this with a console warning (in development), if it attempts to use the default heuristic fragment matcher with unions/interfaces. The `IntrospectionFragmentMatcher` is the solution for working with unions/interfaces, and is explained in more detail below.

The section below explains how to pass the necessary schema knowledge to the Apollo Client cache so unions and interfaces can be accurately matched and results validated before writing them into the store.

To support result validation and accurate fragment matching on unions and interfaces, a special fragment matcher called the `IntrospectionFragmentMatcher` can be used. If there are any changes related to union or interface types in your schema, you will have to update the fragment matcher accordingly.

We recommend setting up a build step that extracts the necessary information from the schema into a JSON file, where it can be imported from when constructing the fragment matcher. To set it up, follow the three steps below:

1. Query your server / schema to obtain the necessary information about unions and interfaces and write it to a file.

You can automate this or set this as a script to run at build time.

If you want to auto-generate the introspection result, there's a tool called [GraphQL Code Generator](https://graphql-code-generator.com) that does it. Define where your GraphQL Schema is available and where to write the file:

```yaml
# codegen.yml
schema: YOUR_API
overwrite: true
generates:
  ./fragmentTypes.json:
    plugins:
      - fragment-matcher
```

With all of that, you simply run:

    gql-gen

> To learn more, you can read the ["Fragment Matcher" chapter](https://graphql-code-generator.com/docs/plugins/fragment-matcher).

In order to introspect the server manually, set this as a script to run at build time.

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
})
  .then(result => result.json())
  .then(result => {
    // here we're filtering out any type information unrelated to unions or interfaces
    const filteredData = result.data.__schema.types.filter(
      type => type.possibleTypes !== null,
    );
    result.data.__schema.types = filteredData;
    fs.writeFile('./fragmentTypes.json', JSON.stringify(result.data), err => {
      if (err) {
        console.error('Error writing fragmentTypes file', err);
      } else {
        console.log('Fragment types successfully extracted!');
      }
    });
  });
```

2. Create a new IntrospectionFragment matcher by passing in the `fragmentTypes.json` file you just created. You'll want to do this in the same file where you initialize the cache for Apollo Client.

```js
import { IntrospectionFragmentMatcher } from 'apollo-cache-inmemory';
import introspectionQueryResultData from './fragmentTypes.json';

const fragmentMatcher = new IntrospectionFragmentMatcher({
  introspectionQueryResultData
});
```

3. Pass in the newly created `IntrospectionFragmentMatcher` to configure your cache during construction. Then, you pass your newly configured cache to `ApolloClient` to complete the process.

```js
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

// add fragmentMatcher code from step 2 here

const cache = new InMemoryCache({ fragmentMatcher });

const client = new ApolloClient({
  cache,
  link: new HttpLink(),
});
```
