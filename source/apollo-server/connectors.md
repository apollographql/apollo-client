---
title: Backend connectors
order: 207
description: Factor out your code data loading logic into connectors.
---

Connectors are the parts that connect the GraphQL server to various backends, such as MySQL servers, MongoDB, Redis, REST, etc. The stores may be on the same server or on a different server, and the same GraphQL server may access a variety of different backend stores to get the data for just one request.

Resolve functions act as a sort of switchboard, defining which connector should be used for which GraphQL types, and what arguments should be passed to it. While resolve functions should be stateless, connectors need to be stateful in many cases, for example to store information about the currently logged in user, or manage connections with the backend store. Because the same connector may be used in many resolve function, it has to be attached to the context, where all the resolve functions easily have access to it.

<h3 id="attachConnectorsToContext" title="attachConnectorsToContext">
  attachConnectorsToContext(schema, connectors)
</h3>

`attachConnectorsToContext` takes two arguments: a GraphQLSchema and a `connectors` object that has connector classes as its named properties. The schema is modified in place such that for each query an instance of each connector will be constructed and attached to the context at the beginning of query execution, effectively making it a singleton that can keep state.

```js
// in connectors.js
import { attachConnectorsToContext } from 'graphql-tools';

class AuthorConnector{
  constructor(){
    this.store = new Map();
    this.store.set(1, { id: 1, firstName: 'Bill', lastName: 'Nye' });
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
