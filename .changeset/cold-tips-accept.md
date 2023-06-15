---
"@apollo/client": minor
---

Use unique opaque types for the `DELETE` and `INVALIDATE` Apollo cache modifiers.

This increases type safety, since these 2 modifiers no longer have the `any` type.
Moreover, it no longer triggers [the `@typescript-eslint/no-unsafe-return`
rule](https://typescript-eslint.io/rules/no-unsafe-return/).
