---
title: Fragment matcher
---
<h2 id="fragment-matcher">Using Fragments on unions and interfaces</h2>

By default, Apollo Client doesn't require any knowledge of the GraphQL schema, which means it's very easy to set up and works with any server and supports even the largest schemas. However, as your usage of Apollo and GraphQL becomes more sophisticated, you may start using fragments on interfaces or unions. Here's an example of a query that uses fragments on an interface:

```
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

In the query above, `all_people` returns a result of type `Character[]`. Both `Jedi` and `Droid` are possible concrete types of `Character`, but on the client there is no way to know that without having some information about the schema. By default, Apollo Client's cache will use a heuristic fragment matcher, which assumes that a fragment matched if the result included all the fields in its selection set, and didn't match when any field was missing. This works in most cases, but it also means that Apollo Client cannot check the server response for you, and it cannot tell you when you're manually writing an invalid data into the store using `update`, `updateQuery`, `writeQuery`, etc.

The section below explains how to pass the necessary schema knowledge to the Apollo Client cache so unions and interfaces can be accurately matched and results validated before writing them into the store.

To support result validation and accurate fragment matching on unions and interfaces, a special fragment matcher called the `IntrospectionFragmentMatcher` can be used. If there are any changes related to union or interface types in your schema, you will have to update the fragment matcher accordingly.

We recommend setting up a build step that extracts the necessary information from the schema into a JSON file, where it can be imported from when constructing the fragment matcher. To set it up, follow the three steps below:

1. Query your server / schema to obtain the necessary information about unions and interfaces and write it to a file. You can set this up as a script to run at build time.

```js
const fetch = require('node-fetch');
const fs = require('fs');

fetch(`${YOUR_API_HOST}/graphql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
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
      if (err) console.error('Error writing fragmentTypes file', err);
      console.log('Fragment types successfully extracted!');
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
