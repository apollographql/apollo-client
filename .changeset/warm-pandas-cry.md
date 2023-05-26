---
'@apollo/client': minor
---

Add the ability to specify custom GraphQL document transforms. These transforms are run before reading data from the cache, before local state is resolved, and before the query document is sent through the link chain.

To register a custom document transform, create a transform using the `DocumentTransform` class and pass it to the `documentTransform` option on `ApolloClient`.

```ts
import { DocumentTransform } from '@apollo/client';

const documentTransform = new DocumentTransform((document) => {
  // do something with `document`
  return transformedDocument;
});

const client = new ApolloClient({ documentTransform: documentTransform });
```

For additional documentation on the behavior and API of `DocumentTransform`, see the [pull request](https://github.com/apollographql/apollo-client/pull/10509).
