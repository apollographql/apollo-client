---
"@apollo/client-graphql-codegen": minor
---

Introduce a new GraphQL Codegen plugin to generate the type policy configuration needed to configure custom scalars for each field.

```ts
// codegen.ts
import type { ScalarTypePoliciesPluginConfig } from "@apollo/client-graphql-codegen/scalar-type-policies";

const config: CodegenConfig = {
  // ...
  generates: {
    "./path/to/schema-type-policies.ts": {
      plugins: ["@apollo/client-graphql-codegen/scalar-type-policies"],
      config: {
        // ...
      } satisfies ScalarTypePoliciesPluginConfig,
    },
  },
};
```

This will generate a `scalarTypePolicies` object in the generated file that can be used to configure type policies.

```ts
import { scalarTypePolicies } from "./path/to/schema-type-policies";

const cache = new InMemoryCache();

cache.policies.addTypePolicies(scalarTypePolicies);
```
