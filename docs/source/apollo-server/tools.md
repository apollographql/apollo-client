---
title: Apollo Server
order: 203
description: Put together all of the Apollo GraphQL tools to create an HTTP server.
---

While `apolloServer` can be used as an express middleware, graphql-tools exports all the functions that `apolloServer` uses internally, so they can be used separately with any GraphQL-JS schema. This section documents all the functions that graphql-tools exports, and explains how they can be used.

<h2 id="apolloServer">apolloServer(options)</h2>

`apolloServer` is a convenient function that generates an express middleware (it uses [`express-graphql`](https://github.com/graphql/express-graphql) under the hood). It combines all of the tools in `graphql-tools` and has a simple-to-use interface:

```js
import { apolloServer } from 'graphql-tools';

var app = express();

app.use('/graphql', apolloServer({ schema: typeDefinitionArray, graphiql: true }));
```

The `options` may be either:
- an object of the below format
- a function that, given an Express [`request`](http://expressjs.com/en/4x/api.html#req), returns an options object

```js
// options object
apolloServer({
  // graphqlHTTP options
  schema: GraphQLSchema | [typeDefinition],
  formatError: Function, // optional
  graphiql: Boolean, // optional
  pretty: Boolean, // optional
  validationRules: Array<any>, // optional
  context: any, // optional
  rootValue: any // optional

  // Apollo options
  resolvers: Object, // required if schema is an array of type definitions
  connectors: Object, // optional
  mocks: Object, // optional
  printErrors: Boolean, // optional
  allowUndefinedInResolve: Boolean, // optional
})

// example options function
apolloServer(request => ({
  schema: typeDefinitionArray,
  graphiql: true,
  context: request.session
}))
```

`apolloServer` wraps the `graphqlHTTP` middleware from [`express-graphql`](https://github.com/graphql/express-graphql). If you replace an existing call to `graphqlHTTP` with a call to `apolloServer`, the resulting express middleware will behave in exactly the same way.

- `graphqlHTTP` options: [express-graphql#options](https://github.com/graphql/express-graphql#options)
- Apollo options:

<h3 id="schema">schema</h3>

In place of a [`GraphQLSchema`](http://graphql.org/docs/api-reference-type-system/#graphqlschema), `apolloServer` also accepts an array of GraphQL schema language type definitions as described in [GraphQL type language](generate-schema.html).

<h3 id="resolvers">resolvers</h3>

Resolvers is a required option if the schema provided to `apolloServer` is in GraphQL schema language. If defined, the option `resolvers` expects an Object that defines a resolve function for each non-scalar field of every type defined in the schema. Fields that take arguments also require a resolve function. A simple example defining a single resolve function for the `author` field of the `RootQuery` type is given below. A more detailed description is given in [Adding resolvers](resolvers.html). Resolve functions should be stateless.

```js
const resolvers = {
  RootQuery: {
    author(root, args){
      return Authors.findOne(args);
    }
  }
}
```

<h3 id="connectors">connectors</h3>

Connectors is not a required option. If provided, the option `connectors` expects an Object that has connector classes as its named property. An instance of each connector will be constructed and attached to the context at the beginning of query execution, effectively making it a singleton that can keep state. This requires that if given, the `context` argument is an object.

```js
// in connectors.js
class AuthorConnector{
  constructor(){
    this.store = new Map()
    map.set(1, { id: 1, firstName: 'Bill', lastName: 'Nye' });
  }

  get(key){
    return this.store.get(key);
  }
  set(key, value){
    return this.store.set(key, value);
  }
}

const connectors = {
  author: AuthorConnector
};

export default connectors;
```

To use connectors in a resolve function:
```js
// in resolvers.js
const resolvers = {
  RootQuery: {
    author(root, args, context) => {
      return context.connectors.author.get(args.id);
    });
  }
}
```

<h3 id="mocks">mocks</h3>

If provided, `mocks` will mock the results of the GraphQL query, overriding any resolve functions defined on the schema. `mocks` expects an object with one function per type that should be mocked. If no function is provided for a type, the default mock will be used, which means that you can call `apolloServer` with `mocks: {}` to get started quickly.

Mocks for scalar types, such as Int and Boolean will be used everywhere, unless they are overridden by a more specific mock defined in a non-scalar type. Mocks for non-scalar types must be a function that returns an object with the desired properties.

```js
import { MockList } from 'graphql-tools';

const mocks = {
  Int: () => 55,
  RootQuery: () => ({
    author: (_, args) => {
      return {id: args.id}, // results in a mocked author object with id args.id
    },
    posts: (_, args) => {
      // results in a mocked list of posts of length between 1 and 5, all having
      // tags = [args.tag]
      return new MockList([1,5], (_, args) => ({ tags: [args.tag] }));
    }
  })
```

Mock functions are a special kind of resolve function, which means they have access to the same arguments that resolve functions have, including arguments and context.

`MockList` can be used to mock a list of items of a specific (or random) length.

You can read more about mocking with graphql-tools in this [Medium Post on mocking with GraphQL](https://medium.com/apollo-stack/mocking-your-server-with-just-one-line-of-code-692feda6e9cd), which also includes more code snippets and a demo.


<h3 id="printerrors">printErrors</h3>

If `printErrors` is set to `true`, the GraphQL server will print all errors that occurred inside resolve functions to the console. By default this option is false, and GraphQL errors will not be printed to the server console, but only returned in the errors field of the query response.

<h3 id="allowundefinedinresolve">allowUndefinedInResolve</h3>

If `allowUndefinedInResolve` is set to `false`, `apolloServer` will throw an Error every time a resolve function returns `undefined`. Usually returning `undefined` from a user-defined resolve function is due to a programming mistake, so this option can be helpful for debugging.

If execution should not continue, resolve functions should return `null` and not `undefined`.

<h2 id="corsSupport">CORS support</h2>

An issue was discovered re: CORS when using the apolloClient to connect to an apolloServer running on a different instance. 
To account for this CORS support must be configured in the express app. [CORS](https://github.com/expressjs/cors) is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options. 

```
import { apolloServer } from 'graphql-tools';
import cors from 'cors';

var app = express().use('*', cors());;
```

Ensure you have npm installed cors. The * value allows access from any third-party site. It should probably be updated to reflect your specific environment. Simple usage details to [Enable All CORS Requests](https://github.com/expressjs/cors#simple-usage-enable-all-cors-requests) More complex configuration options are available including the ability to [Enable CORS for a Single Route](https://github.com/expressjs/cors#enable-cors-for-a-single-route).

The information contained in the apolloClient re: CORS configuration did not effect on the server.

