---
title: Custom Scalars
order: 209
description: Add custom scalars to a GraphQL schema.
---

## Custom scalars

The GraphQL language comes with the following pre-defined scalar types: `String`, `Int`, `Float` and `Boolean`. While this covers most of the user cases, often you need to support custom atomic data types (e.g. Date), or you need to add validations to existing types. As a result, GraphQL allows you to define custom `scalar`s that undertake this role.

To define a custom scalar you simply add it to the schema with the following notation:

```js
scalar MyCustomScalar
```

Consequently, you need to define the behaviour of the scalar: how it will be serialized when the value is sent to the client, and how the value is resolved when received from the client. For this purpose, each scalar needs to define three methods. In schemas defined with `graphql-tools` they are named `__serialize`, `__parseValue` and `__parseLiteral`. (If you're using `graphql-js` directly, the methods do not have the `__` prefix.)

Note that [Apollo Client does not currently support custom scalars](https://github.com/apollostack/apollo-client/issues/585), so there's no way to automatically apply the same transformations on the client side.

Let's look at a couple of examples to demonstrate the potential of custom scalars.

### Date as a scalar

The goal is to define a `Date` data type for storing `Date` values in the database. We're using a MongoDB driver that uses the native JavaScript `Date` data type. The `Date` data type can be easily serialized as a number using the [`getTime()` method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime). Therefore, the GraphQL server will send and receive `Date`s as numbers. This number will be resolved to a `Date` on the server representing the date value. On the client, the user can simply create a new date from the received numeric value.

The following is the implementation of the `Date` data type. First, the schema:

```js
scalar Date

type MyType {
   created: Date
}
```

Next, the resolver:

```js
import { Kind } from 'graphql/language';

Date: {
  __parseValue(value) {
    return new Date(value); // value from the client
  },
  __serialize(value) {
    return value.getTime(); // value sent to the client
  },
  __parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return parseInt(ast.value, 10); // ast value is always in string format
    }
    return null;
  },
}
```

### Validations

In this example, we follow the [official GraphQL documentation](http://graphql.org/docs/api-reference-type-system/) for the scalar datatype. Let's say that you have a database field that should only contain odd numbers. First, the schema:

```js
scalar Odd

type MyType {
    oddValue: Odd
}
```

Next, the resolver:

```js
import { Kind } from 'graphql/language';

Odd: {
  __serialize: oddValue,
  __parseValue: oddValue,
  __parseLiteral(ast) {
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

### JSON as a scalar

While we usually want to define a schema for our data, in some cases it makes sense to store unstructured objects in the database and not define a GraphQL schema for it. JSON is a commonly used format for storing such objects. In GraphQL, we can define a custom scalar type to serialize and parse JSON:


```js
scalar JSON

type MyType {
   jsonField: JSON
}
```

And the implementation of the resolver:

```js
import { Kind } from 'graphql/language';

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

For more information please refer to the [official documentation](http://graphql.org/docs/api-reference-type-system/) or to the [Learning GraphQL](https://github.com/mugli/learning-graphql/blob/master/7.%20Deep%20Dive%20into%20GraphQL%20Type%20System.md) tutorial.
