---
title: Setup and options
---
<h2 id="installation">Installation</h2>

To get started with Apollo and React, install the `react-apollo` npm package. This exports everything you need to get started, even though there are several packages involved under the hood.

```bash
npm install react-apollo --save
```

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.

To get started using Apollo with React, we need to create an `ApolloClient` and an `ApolloProvider`.

- `ApolloClient` serves as a central store of query result data which caches and distributes the results of our queries.
- `ApolloProvider` makes that client instance available to our React component hierarchy.

<h2 id="creating-client">Creating a client</h2>

To get started, create an [`ApolloClient`](/core/apollo-client-api.html#constructor) instance and point it at your GraphQL server:

```js
import { ApolloClient } from 'react-apollo';

// By default, this client will send queries to the
//  `/graphql` endpoint on the same host
const client = new ApolloClient();
```

The client takes a variety of [options](/core/apollo-client-api.html#constructor), but in particular, if you want to change the URL of the GraphQL server, you can create a custom [`NetworkInterface`](/core/apollo-client-api.html#NetworkInterface):

```js
import { ApolloClient, createNetworkInterface } from 'react-apollo';

const networkInterface = createNetworkInterface({
  uri: 'http://api.example.com/graphql'
});

const client = new ApolloClient({
  networkInterface: networkInterface
});
```

`ApolloClient` has some other options which control the behavior of the client, and we'll see examples of their use throughout this guide.

<h2 id="creating-provider">Creating a provider</h2>

To connect your client instance to your component tree, use an `ApolloProvider` component. We suggest putting the `ApolloProvider` somewhere high in your view hierarchy, above any places where you need to access GraphQL data. For example, it could be outside of your root route component if you're using React Router.

```js
import { ApolloClient, ApolloProvider } from 'react-apollo';

// Create the client as outlined above
const client = new ApolloClient();

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyAppComponent />
  </ApolloProvider>,
  document.getElementById('root')
)
```

<h2 id="connecting-data">Requesting data</h2>

The `graphql()` container is the recommended approach for fetching data or making mutations. It is a React [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects), and interacts with the wrapped component via props.

The basic usage of `graphql()` is as follows:

```js
import React, { Component } from 'react';
import { gql, graphql } from 'react-apollo';

// MyComponent is a presentational component, unaware of Apollo
const MyComponent = (props) => (
  <div>...</div>
);

// Initialize GraphQL queries or mutations with the `gql` tag
const MyQuery = gql`query { todos { text } }`;
const MyMutation = gql`mutation { addTodo(text: "Test 123") { id } }`;

// We then can use `graphql` to pass the query results returned by MyQuery
// to MyComponent as a prop (and update them as the results change)
const MyComponentWithData = graphql(MyQuery)(MyComponent);

// Or, we can bind the execution of MyMutation to a prop
const MyComponentWithMutation = graphql(MyMutation)(MyComponent);
```

If you are using [ES2016 decorators](https://medium.com/google-developers/exploring-es7-decorators-76ecb65fb841#.nn723s5u2) with React class components, you may prefer the more concise decorator syntax, which does the exact same thing:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

@graphql(MyQuery)
@graphql(MyMutation)
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
```

In this guide, we won't use the decorator syntax to make the code more approachable, but any example can be converted to use a decorator instead.


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
import Cache from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

// add fragmentMatcher code from step 2 here

const cache = new Cache({ fragmentMatcher });

const client = new ApolloClient({
  cache,
  link: new HttpLink(),
});
```
