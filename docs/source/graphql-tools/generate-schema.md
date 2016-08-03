---
title: Generating a schema
order: 204
description: Generate a GraphQL schema from the concise type definition language.
---

The graphql-tools package allows you to create a GraphQLSchema instance from GraphQL schema language by using the function `makeExecutableSchema`.

<h3 id="generateSchema" title="generateSchema">makeExecutableSchema(typeDefs, resolvers)</h3>

```
import { makeExecutableSchema } from 'graphql-tools';

const jsSchema = makeExecutableSchema(
  typeDefinitions,
  resolveFunctions,
  connectors,
  logger,
  allowUndefinedInResolve = false, //optional
  resolverValidationOptions = {}, //optional
);
```

`typeDefinitions` is a required argument and should be an array of GraphQL schema language strings or a function that takes no arguments and returns an array of GraphQL schema language strings. The order of the strings in the array is not important, but it must include a schema definition.

`resolveFunctions` is a required argument and should be an object that follows the pattern explained in the guide [section on resolvers](http://docs.apollostack.com/apollo-server/resolvers.html).

`connectors` is an optional argument, which will take the connectors object provided and attach them to the context of every resolve function. See the [connector docs](http://docs.apollostack.com/graphql-tools/connectors.html) for more information.

`logger` is an optional argument, which can be used to print errors to the server console that are usually swallowed by GraphQL. The `logger` argument should be an object with a `log` function, eg. `const logger = { log: (e) => console.log(e) }`

`allowUndefinedInResolve` is an optional argument, which is `false` by default, and causes your resolve function to throw an error, if they return undefined. This can help make debugging easier. To get the default behavior of GraphQL, set this option to `true`.

`resolverValidationOptions` is an optional argument which accepts an object of the following shape: `{ requireResolversForArgs, requireResolversForNonScalar }`. If set to true, `requireResolversForArgs` will cause `makeExecutableSchema` to throw an error, if no resolve function is defined for a field that has arguments. Similarly, `requireResolversForNonScalar` will cause `makeExecutableSchema` to throw an error if a non-scalar field has no resolver defined. By default, both of these are true, which can help catch errors faster. To get the normal behavior of GraphQL, set both of them to `false`.

The type definitions must define a query type, which means a minimal schema would look something like this:
```js
const typeDefinition = [`
  schema {
    query: RootQuery
  }

  type RootQuery {
    aNumber: Int
  }
`];
```

If your schema gets large, you may want to define parts of it in different files and import them to create the full schema. This is possible by including them in the array. If there are circular dependencies, the array should be wrapped in arrow function. `makeExecutableSchema` will only include each type definition once, even if it is imported multiple times by different types.

```js
// in author.js -------------------
import Book from './book';

const Author = `
  type Author {
    name: String
    books: [Book]
  }
`;

// we export have to export Author and all types it depends on in order to make it reusable
export default () => [Author, Book];
```

```js
// in book.js -----------------------
import Author from './author';

const Book = `
  type Book {
    title: String
    author: Author
  }
`;

export default () => [Book, Author];
```

```js
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

export default makeExecutableSchema([SchemaDefinition, RootQuery, Author], {});
```

This [GraphQL schema language cheat sheet](https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png) by Hafiz Ismail is an excellent reference for all the features of the GraphQL schema language.
