---
title: Adding resolvers
order: 205
description: Add resolvers to a GraphQL schema.
---

## Resolve functions
In order to respond to queries, a schema needs to have resolve functions. Resolve functions cannot be included in the GraphQL schema language, so they must be added separately.

<h3 id="addResolveFunctionsToSchema" title="addResolveFunctionsToSchema">
  addResolveFunctionsToSchema(schema, resolveFunctions)
</h3>

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
Note that if the types were defined in GraphQL schema language, the `info` argument to `resolveType` must be used to get a reference to the actual type, eg. `return info.schema.getType("Person")`. This may be changed in the future to support returning just the name of the type, eg. `return "Person"`.

<h3 id="addSchemaLevelResolveFunction" title="addSchemaLevelResolveFunction">
  addSchemaLevelResolveFunction(schema, rootResolveFunction)
</h3>

Some operations, such as authentication, need to be done only once per query. Logically, these operations belong in a root resolve function, but unfortunately GraphQL-JS does not let you define one. `addSchemaLevelResolveFunction` solves this by modifying the GraphQLSchema that is passed as the first argument.
