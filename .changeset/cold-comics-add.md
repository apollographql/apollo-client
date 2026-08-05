---
"@apollo/client": minor
---

Adds `Scalar.fromGraphQLScalarType` helper to create a `Scalar` instance from an existing graphql.js `GraphQLScalarType`.

```ts
import { GraphQLScalarType } from "graphql";
import { Scalar } from "@apollo/client";

const dateTimeScalarType = new GraphQLScalarType<Date, string>({
  // ...
});

const dateTimeScalar = Scalar.fromGraphQLScalarType(dateTimeScalarType, {
  is: (value) => value instanceof Date,
});
```
