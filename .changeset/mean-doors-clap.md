---
"@apollo/client": major
---

You must now opt in to use GraphQL Codegen data masking types when using Apollo Client's data masking feature. By default, Apollo Client now uses an identity type to apply to masked/unmasked types.

If you're using GraphQL Codegen to generate masked types, opt into the GraphQL Codegen masked types using declaration merging on the `TypeOverides` interface.

```ts title="apollo-client.d.ts
import { GraphQLCodegenDataMasking } from "@apollo/client/masking";

declare module "@apollo/client" {
  export interface TypeOverrides extends GraphQLCodegenDataMasking.TypeOverrides {}
}
```
