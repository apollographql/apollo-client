---
title: Fragments
order: 104
description: How to compose your queries and mutations from fragments with Apollo Client.
---

Apollo Client supports composition of queries and mutations using named fragments. For example, if you have several UI components and each defines a fragment that it must fetch in order to render itself, a root UI component can compose a single query that references each of those fragments. This single query is then fetched from the server and will return the data requested by each of the fragments. This allows you to get the data needed to render all of those UI components in a single request to your GraphQL server.

Note that a similar effect can be achieved with [batching](network.html#query-batching), so it's up to you to decide when it's a good idea to use fragments vs. batching. Fragments are particularly useful in cases when you need to render nested components, each with their own data requirements.

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

<h2 id="using-fragments">Using fragments</h2>

Fragments are especially helpful in the case where you have deeply nested UI components, and you want to keep the fields the component needs next to the component code itself. You also want to avoid multiple roundtrips. Imagine the following UI structure:

```html
<Author>
  <Book />
  <Book />
  <Book />
</Author>
```

To render such a UI, without fragments the first intuition might be:

```js
// One query on the Author component to render the list of books
{
  author(id: 5) {
    books {
      id
    }
  }
}

// Another query on the Book component to get book details
{
  book(id: 19) {
    name
    coverImage
    numPages
  }
}
```

However, this isn't optimal because you have to wait to get the entire list of books before you send any requests to get the details. This means the data will only appear after two roundtrips to the server. It would be much better to instead compose these two queries together into one, and send that in one request. Here's how you could do that:

```js
import { createFragment } from 'apollo-client';

// Save the fragment into a variable
const bookInfoFragment = createFragment(gql`
  fragment bookInfo on Book {
    name
    coverImage
    numPages
  }
`);

// Use the fragment in a query
// Note that we use the fragment name to refer to it, not the variable name from JavaScript.
client.query({
  query: gql`
    {
      author(id: 5) {
        books {
          id
          ...bookInfo
        }
      }
    }
  `,
  fragments: bookInfoFragment,
})
```

<h2 id="unique-names">Unique fragment names</h2>

For better server-side debugging and logging, it's good to have the fragment names in your app be unique. If your fragments have unique names, Apollo Client doesn't have to generate fragment names for you, which means you can easily see which fragments are appearing in your network logs and server-side debugging tools. Apollo Client checks that fragment names are unique across your application for you, and will warn you if you create two fragments with the same name.
