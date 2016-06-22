---
title: Custom Scalars
order: 209
description: Add custom scalars to a GraphQL schema.
---

## Custom scalars

The GraphQL language comes with following pre-defined scalar types `String`,
`Int`, `Float` and `Boolean`. While this covers most of the user cases, often
you need to support custom atomic data types (e.g. Date) or you need to add validations
to existing types. As a result, GraphQL allows you to define custom `scalars`
that undertake this role.

To define a custom scalar you simply add it to the schema with the following notation:

```js
scalar MyCustomScalar
```

Consequently, you need to define the behaviour of the scalar, the way it will be serialised
when the value is sent to the client, or how the value is resolved when coming from the client.
For this purpose, each scalar needs to define three methods: `serialize`, `parseValue` and `parseLiteral`.
In Apollo, these functions are defined with the `__` prefix: `__serialize`, `__parseValue` and `__parseLiteral`.
Let's look at couple examples to demonstrate the potential of custom scalars.

### Date scalar

The goal is to define a Date data type for storing the Date values in the database.
We will consider using the MongoDB that uses the native javascript `Date` data type. The `Date` data type
can be easily serialised as a number using the `getTime()` function. Therefore, we will assume that
user sends and receives a number to and from the grapqhl server. This number will be resolved to Date on the server
storing the date value. On client, user can simply create a new date from the received numeric value. Following is the
implementation of the Date data type. First, the schema:

```js
scalar Date

type MyType {
   created: Date
}
```

And here is the resolver:

```js
Date: {
  __parseValue (value) {
    return new Date(value); // value from the client
  },
  __serialize(value) {
    return value.getTime(); // value sent to the client
  },
  __parseLiteral (ast) {
    if (ast.kind === Kind.INT) {
      return (parseInt(ast.value, 10)); // ast value is always in string format
    }
    return null;
  },
}
```

### Validations

In this example, we follow the [official GraphQL documentation](http://graphql.org/docs/api-reference-type-system/) for the scalar datatype.
Consider that you wan to store only odd values in your database field. First, the schema:

```js
scalar Odd

type MyType {
    oddValue: Odd
}
```

And now the resolver:

```js
import { Kind } from 'graphql/type'

Odd: {
  __serialize: oddValue,
  __parseValue: oddValue,
  __parseLiteral (ast) {
    if (ast.kind === Kind.INT) {
      return oddValue(parseInt(ast.value, 10));
    }
    return null;
  }
}

function oddValue(value) {
  return value % 2 === 1 ? value : null;
}
```

### JSON data type

While we usually want to define a schema for our data, in some cases it makes sense to store unstructured objects in the database, and not define a GraphQL schema for it. JSON is a commonly used format for storing such objects.
In GraphQL, we can define a custom scalar type to serialize and parse JSON:


```js
scalar JSON

type MyType {
   jsonField: JSON
}
```

And the implementation of the resolver:

```js
function parseJSONLiteral(ast) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT: {
      const value = Object.create(null);
      ast.fields.forEach(field => {
        value[field.name.value] = parseJSONLiteral(field.value);
      });

      return value;
    }
    case Kind.LIST:
      return ast.values.map(parseJSONLiteral);
    default:
      return null;
  }
}

const resolvers =
  JSON: {
    __parseLiteral: parseJSONLiteral,
    __serialize: value => value,
    __parseValue: value => value,
  },
};
```

For more information please refer to [official documentation](http://graphql.org/docs/api-reference-type-system/) or
to the [learn GraphQL](https://github.com/mugli/learning-graphql/blob/master/7.%20Deep%20Dive%20into%20GraphQL%20Type%20System.md) website.
