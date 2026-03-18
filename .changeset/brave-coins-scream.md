---
"@apollo/client": minor
---

Introduce "classic" and "modern" method and hook signatures.

Apollo Client 4.2 introduces two signature styles for methods and hooks. All signatures previously present are now "classic" signatures, and a new set of "modern" signatures are added alongside them.

**Classic signatures** are the default and are identical to the signatures before Apollo Client 4.2, preserving backward compatibility. Classic signatures still work with manually specified TypeScript generics (e.g., `useSuspenseQuery<MyData>(...)`). However, manually specifying generics has been discouraged for a long time—instead, we recommend using `TypedDocumentNode` to automatically infer types, which provides more accurate results without any manual annotations.

**Modern signatures** automatically incorporate your declared `defaultOptions` into return types, providing more accurate types. Modern signatures infer types from the document node and do not support manually passing generic type arguments; TypeScript will produce a type error if you attempt to do so.

Methods and hooks automatically switch to modern signatures the moment any non-optional property is declared in `DeclareDefaultOptions`. The switch happens across all methods and hooks globally:

```ts
// apollo.d.ts
import type {} from "@apollo/client";
declare module "@apollo/client" {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface WatchQuery {
        errorPolicy: "all"; // non-optional → modern signatures activated automatically
      }
    }
  }
}
```

Users can also manually switch to modern signatures without declaring any `defaultOptions`, for example when wanting accurate type inference without relying on global `defaultOptions`:

```ts
// apollo.d.ts
import type {} from "@apollo/client";
declare module "@apollo/client" {
  export interface TypeOverrides {
    signatureStyle: "modern";
  }
}
```

Users can do a global `DeclareDefaultOptions` type augmentation and then manually switch back to "classic" for migration purposes:

```ts
// apollo.d.ts
import type {} from "@apollo/client";
declare module "@apollo/client" {
  export interface TypeOverrides {
    signatureStyle: "classic";
  }
}
```

Note that this is **not recommended for long-term use**. When combined with `DeclareDefaultOptions`, switching back to classic results in the same incorrect types as before Apollo Client 4.2—methods and hooks will not reflect the `defaultOptions` you've declared.
