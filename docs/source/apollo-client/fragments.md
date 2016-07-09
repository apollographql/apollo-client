---
title: Fragments
order: 104
description: How to compose your queries and mutations from fragments with Apollo Client.
---

Apollo Client supports composition of queries and mutations using named fragments. For example, if you have several UI components and each defines a fragment that it must fetch in order to render itself, a root UI component can compose a single query that references each of those fragments. This single query is then fetched from the server and will return the data requested by each of the fragments. This alows you to get the data needed to render all of those UI components in a single request to your GraphQL server.

<h2 id="creating-fragments">Creating fragments</h2>

Fragments can be defined anywhere in your application code where you need a reusable bit of a GraphQL query.

<h3 id="createFragment" title="createFragment()">createFragment</h3>

To create a fragment, you can use the `createFragment` function which can be imported from the `apollo-client` package like so:

```
import { createFragment } from 'apollo-client'
```

This function takes the following arguments:

- `doc: Document`: A GraphQL document defined with a `gql` template literal, just like a query. This can contain one or more fragment definitions.
- `fragments: FragmentDefinition[]` (Optional): A list of fragments that are used in the document, so that you can pass around a fragment and any of its dependencies as one unit.

The method `createFragment` returns an array of `FragmentDefinition` objects extracted from `doc`. This array can be passed to the `query`, `watchQuery` or `mutate` methods on Apollo Client, allowing the GraphQL query or mutation to reference these fragments.

<h3 id="fragment-example" title="fragment-example">Example with fragments</h3>

Say we need to fetch a list of authors' names in one UI component and fetch the cities they live in from another UI component.

```javascript
client.query({ query: gql`
  query {
    author {
      firstName
      lastName
    }
  }`,
});

client.query({query: gql`
  query {
    author {
      city
    }
  }`,
})

```

Instead of firing those two queries separately, we can define the data that they request as fragments and register them with Apollo Client. Then, we can compose a single query that uses these fragments and fire that instead. We can do that with `createFragment`:

```javascript
import { createFragment } from 'apollo-client';

const fragmentDefs = createFragment(gql`
  fragment authorNames on Author {
    firstName
    lastName
  }

  fragment authorCities on Author {
    city
  }
`);

client.query({ query: gql`
  query {
    author {
      ...authorNames
      ...authorCities
    }
  }
  `,
}, fragmentDefs);
```

By doing this, we're no longer firing two queries. Instead, we're only firing one query which will get us all the data that we need. So, query composition through named fragments benefits you by reducing the number of roundtrips you make to the server. Query composition through fragments is often useful when we you want to load nested data, refetch the same data in a mutation and a query or if a UI component defines its own fields.

<h3 id="unique-names">Unique fragment names</h3>

For query composition through fragments to work, Apollo Client requires unique fragment names across your application and will warn you if this is not the case. We can use the `createFragment` method to register a fragment for use in queries or mutations.
