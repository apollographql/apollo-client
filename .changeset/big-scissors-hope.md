---
"@apollo/client-graphql-codegen": minor
---

Introduce a new GraphQL Codegen plugin to generate the input object configuration needed to configure custom scalars for each field.

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

This will generate an `inputObjects` object in the generated file that can be used to configure the `inputObjects` option for `InMemoryCache`.

```ts
import { inputObjects } from "./path/to/custom-scalars";

const cache = new InMemoryCache({
  inputObjects,
});
```
