---
"@apollo/client": minor
_tags:
  - types
---

Provide a mechanism to override the DataMasking types.

Up until now, our types `Masked`, `MaskedDocumentNode`, `FragmentType`, `MaybeMasked` and `Unmasked` would assume that you are stictly using the type output format of GraphQL Codegen.

With this change, you can now modify the behaviour of those types if you use a different form of codegen that produces different types for your queries.

A simple implementation that would override the `Masked` type to remove all fields starting with `_` from a type would look like this:

```ts
// your actual implementation of `Masked`
type CustomMaskedImplementation<TData> = {
  [K in keyof TData as K extends `_${string}` ? never : K]: TData[K];
};

import { HKT } from "@apollo/client/utilities";
// transform this type into a higher kinded type that can be evaulated at a later time
interface CustomMaskedType extends HKT {
  arg1: unknown; // TData
  return: CustomMaskedImplementation<this["arg1"]>;
}

// create an "implementation interface" for the types you want to override
export interface CustomDataMaskingImplementation {
  Masked: CustomMaskedType;
  // other possible keys: `MaskedDocumentNode`, `FragmentType`, `MaybeMasked` and `Unmasked`
}
```
then you would use that `CustomDataMaskingImplementation` interface in your project to extend the `TypeOverrides` interface exported by `@apollo/client` with it's functionality:

```ts
declare module "@apollo/client" {
  export interface TypeOverrides extends CustomDataMaskingImplementation {}
}
```

After that, all internal usage of `Masked` in Apollo Client as well as all usage in your code base will use the new `CustomMaskedType` implementation.

If you don't specify overrides, Apollo Client will still default to the GraphQL Codegen data masking implementation.
The types for that are also explicitly exported as the `GraphQLCodegenDataMasking` namespace in `@apollo/client/masking`.
