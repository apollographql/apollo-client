---
title: Documentation for graphql-tools
order: 203
description: These are Apollo Docs!!
---

While `apolloServer` can be used as an express middleware, graphql-tools exports all the functions that `apolloServer` uses internally, so they can be used separately with any GraphQL-JS schema. This section documents all the functions that graphql-tools exports, and explains how they can be used.

## Express middleware

### apolloServer(schema, [...])

`apolloServer` is a convenient function that generates an express middleware (it uses express-graphql under the hood). It combines all of the tools in graphql-tools and has a simple to use interface:

```
import { apolloServer } from 'graphql-tools';

var app = express();

app.use('/graphql', apolloServer({ schema: typeDefinitionArray, graphiql: true }));
```


**Function signature**
```
apolloServer({
  // options in common with graphqlHTTP from express-graphql
  schema: GraphQLSchema | [typeDefinition],
  formatError: function, // optional
  graphiql: Boolean, // optional
  pretty: Boolean, // optional
  validationRules: Array<any>, // optional
  context: any, // optional
  rootValue: any // optional

  // options specific to apolloServer
  resolvers: Object, // required if schema is an array of type definitions
  connectors: Object, // optional
  mocks: Object, // optional
  allowUndefinedInResolve: Boolean, // optional
  printErrors: Boolean, // optional
  })
```

The function `apolloServer` wraps the `graphqlHTTP` middleware from `express-graphql`. If you replace an existing call to `graphqlHTTP` with a call to `apolloServer`, the resulting express middleware will behave in exactly the same way. For the documentation of the graphqlHTTP arguments, refer to the express-graphql [documentation](https://github.com/graphql/express-graphql#options).

**schema**
In place of a GraphQLSchema, `apolloServer` also accepts an array of GraphQL shorthand type definitions as described in [Schema creation](#Schema-creation).

**resolvers**
Resolvers is a required option if the schema provided to `apolloServer` is in shorthand GraphQL schema language. If defined, the option `resolvers` expects an Object that defines a resolve function for each non-scalar field of every type defined in the schema. Fields that take arguments also require a resolve function. A simple example defining a single resolve function for the `author` field of the `RootQuery` type is given below. A more detailed description is given in [Resolve functions](#Resolve-functions). Resolve functions should be stateless.

```js
const resolvers = {
  RootQuery: {
    author(root, args){
      return Authors.findOne(args);
    }
  }
}
```

**connectors**
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

**mocks**
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


**printErrors**
If `printErrors` is set to `true`, the GraphQL server will print all errors that occurred inside resolve functions to the console. By default this option is false, and GraphQL errors will not be printed to the server console, but only returned in the errors field of the query response.

**allowUndefinedInResolve**
If `allowUndefinedInResolve` is set to `false`, `apolloServer` will throw an Error every time a resolve function returns `undefined`. Usually returning `undefined` from a user-defined resolve function is due to a programming mistake, so this option can be helpful for debugging.

If execution should not continue, resolve functions should return `null` and not `undefined`.

## Schema creation

The graphql-tools package allows you to create a GraphQLSchema object from shorthand schema language by using the function `createSchema`.

### createSchema(typeDefinitions)
**Function signature**
```
import { createSchema } from 'graphql-tools';

const jsSchema = createSchema(typeDefinitions);
```

`typeDefinitions` should be an array of shorthand schema strings or a function that takes no arguments and returns an array of shorthand schema strings. The order of the strings in the array is not important, but it must include a schema definition. The schema must define a query type, which means a minimal schema would look something like this:
```js
const typeDefinition = [`
schema {
  query: RootQuery
}

type RootQuery {
  aNumber: Int
}`];

const jsSchema = createSchema(typeDefinition);
```

If your schema gets large, you may want to define parts of it in different files and import them to create the full schema. This is possible by including them in the array. If there are circular dependencies, the array should be wrapped in arrow function. `createSchema` will only include each type definition once, even if it is imported multiple times by different types.

```js
// in author.js -------------------
import Book from './book';

const Author = `
  type Author {
    name: String
    books: [Book]
  }
`;

export default () => [Author, Book];

// in book.js -----------------------
import Author from './author';

const Book = `
  type Book {
    title: String
    author: Author
  }
`;

export default () => [Book, Author];

// in schema.js ----------------------
import Author from './author.js';

const RootQuery = `
  type RootQuery {
    author(name: String): Author
  }
`;

const SchemaDefinition = `
  schema {
    query: RootQuery
  }
`;

export default createSchema([SchemaDefinition, RootQuery, Author]);
```


## Resolve functions
In order to respond to queries, a schema needs to have resolve functions. Resolve functions cannot be included in the shorthand schema notation, so they must be added separately.

### addResolveFunctionsToSchema(schema, resolveFunctions)

`addResolveFunctionsToSchema` takes two arguments, a GraphQLSchema and an object defining resolve functions, and modifies the schema in place to. The `resolveFunctions` object should have one property for each type that has fields which need a resolve function. The following is an example of a valid resolveFunctions object:
```js
import { addResolveFunctionsToSchema } from 'graphql-tools';

const resolveFunctions = {
  RootQuery: {
    author(root, { name }){
      return Author.find({ name });
    },
  },
};

addResolveFunctionsToSchema(schema, resolveFunctions);
```

For types which need to define additional properties, such as `resolveType` for unions and interfaces, the property can be set by prefixing it with two underscores, eg. `__resolveType` for `resolveType`:

```js
const resolveFunctions = {
  SomeUnionType: {
    __resolveType(data, context, info){
      if(data.wingspan){
        return info.schema.getType('Airplane');
      }
      if(data.horsepower){
        return info.schema.getType('Car');
      }
      return null;
    },
  },
};
```
Note that if the types were defined in shorthand schema notation, the `info` argument to `resolveType` must be used to get a reference to the actual type, eg. `return info.schema.getType("Person")`. This may be changed in the future to support returning just the name of the type, eg. `return "Person"`.

### addSchemaLevelResolver(schema, rootResolveFunction)
Some operations, such as authentication, need to be done only once per query. Logically, these operations belong in a root resolve function, but unfortunately GraphQL-JS does not let you define one. `addSchemaLevelResolver` solves this by modifying the GraphQLSchema that is passed as the first argument.

## Mocking

### mockServer(schema, mocks = {}, preserveResolvers = false)

For more information about how to use the `mockServer` function, see the [Medium Post about mocking](https://medium.com/apollo-stack/mocking-your-server-with-just-one-line-of-code-692feda6e9cd).

### addMocksToSchema(schema, mocks = {}, preserveResolvers = false)

`addMocksToSchema` is the function that `mockServer` uses under the hood. Given an instance of GraphQLSchema and a mock object, it modifies the schema in place to return mock data for any valid query that is sent to the server. If `mocks` is not passed, the defaults will be used for each of the scalar types. If `preserveResolvers` is set to `true`, existing resolve functions will not be overwritten to provide mock data. This can be used to mock some parts of the server and not others.

## Logging and performance profiling

coming soon ...

## Authentication and authorization

coming soon ...

## Unit- and integration testing

coming soon ...

## Connectors
Connectors are the parts that connect the GraphQL server to various backends, such as MySQL servers, MongoDB, Redis, REST, etc. The stores may be on the same server or on a different server, and the same GraphQL server may access a variety of different backend stores to get the data for just one request.

Resolve functions act as a sort of switchboard, defining which connector should be used for which GraphQL types, and what arguments should be passed to it. While resolve functions should be stateless, connectors need to be stateful in many cases, for example to store information about the currently logged in user, or manage connections with the backend store. Because the same connector may be used in many resolve function, it has to be attached to the context, where all the resolve functions easily have access to it.

### attachConnectorsToContext(schema, connectors)
`attachConnectorsToContext` takes two arguments: a GraphQLSchema and a `connectors` object that has connector classes as its named properties. The schema is modified in place such that for each query an instance of each connector will be constructed and attached to the context at the beginning of query execution, effectively making it a singleton that can keep state.

```js
// in connectors.js
import { attachConnectorsToContext } from 'graphql-tools';

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
  Author: AuthorConnector,
};

attachConnectorsToContext(schema, connectors);


// --- in a resolve function ---
resolveAuthor(obj, args, context){
  return context.connectors.Author.get(args.id);
}
```

## Error handling + error logging
GraphQL servers can be tricky to debug. The following functions can help find error faster in many cases.

### forbidUndefinedInResolve(schema)
ForbidUndefinedInResolve can be used during debugging to find mistakes in resolve functions faster. Usually, resolve functions only return undefined due to programmer error. `forbidUndefinedInResolve` takes a GraphQLSchema as input, and modifies it in place to throw an error when a resolve function returns undefined, telling you exactly which resolver returned undefined.
```js
import { forbidUndefinedInResolve } from 'graphql-tools';

forbidUndefinedInResolve(schema);
```


### addErrorLoggingToSchema(schema, logger)
This function may be deprecated in the near future. Instead of using addErrorLoggingToSchema, the `formatError` option of `apolloServer` or `graphqlHTTP` should be used, which was recently added in graphql-js v0.5.0

`addErorrLoggingToSchema` takes two arguments: `schema` and `logger`. `schema` must be an instance of `GraphQLSchema`, `logger` must be an Object with a callable property `log`. Every time an error occurs, `logger.log(e)` will be called.
```js
import { addErrorLoggingToSchema } from 'graphql-tools';
const logger = { log: (e) => console.error(e.stack) };
addErrorLoggingToSchema(mySchema, logger);
```
