---
"@apollo/client-graphql-codegen": minor
---

The `@apollo/client-graphql-codegen/custom-scalars` GraphQL Codegen plugin now generates the type policy configuration needed to configure custom scalars for each field.

```ts
// codegen.ts
import type { CustomScalarsPluginConfig } from "@apollo/client-graphql-codegen/custom-scalars";

const config: CodegenConfig = {
  // ...
  generates: {
    "./path/to/custom-scalars.ts": {
      plugins: ["@apollo/client-graphql-codegen/custom-scalars"],
      config: {
        // ...
      } satisfies CustomScalarsPluginConfig,
    },
  },
};
```

This will generate a `scalarTypePolicies` object in the generated file that can be used to configure type policies.

```ts
import { scalarTypePolicies } from "./path/to/custom-scalars";

const cache = new InMemoryCache();

cache.policies.addTypePolicies(scalarTypePolicies);
```
