---
title: GraphQL type language
order: 204
description: Generate a GraphQL schema from the concise type definition language.
---

The graphql-tools package allows you to create a GraphQLSchema instance from GraphQL schema language by using the function `generateSchema`.

<h3 id="generateSchema" title="generateSchema">generateSchema(typeDefinitions)</h3>

```
import { generateSchema } from 'graphql-tools';

const jsSchema = generateSchema(typeDefinitions);
```

`typeDefinitions` should be an array of GraphQL schema language strings or a function that takes no arguments and returns an array of GraphQL schema language strings. The order of the strings in the array is not important, but it must include a schema definition. The schema must define a query type, which means a minimal schema would look something like this:
```js
const typeDefinition = [`
  schema {
    query: RootQuery
  }

  type RootQuery {
    aNumber: Int
  }
`];

const jsSchema = generateSchema(typeDefinition);
```

If your schema gets large, you may want to define parts of it in different files and import them to create the full schema. This is possible by including them in the array. If there are circular dependencies, the array should be wrapped in arrow function. `generateSchema` will only include each type definition once, even if it is imported multiple times by different types.

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

export default generateSchema([SchemaDefinition, RootQuery, Author]);
```

This [GraphQL schema language cheat sheet](https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png) by Hafiz Ismail is an excellent reference for all the features of the GraphQL schema language.
