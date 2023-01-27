---
"@apollo/client": patch
---

Bumps TypeScript to `4.9.4` (previously `4.7.4`) and updates types to account for changes in TypeScript 4.8 by [propagating contstraints on generic types](https://devblogs.microsoft.com/typescript/announcing-typescript-4-8/#unconstrained-generics-no-longer-assignable-to). Technically this makes some types stricter as attempting to pass `null|undefined` into certain functions is now disallowed by TypeScript, but these were never expected runtime values in the first place.
