---
"@apollo/client": patch
---

Declare `@types/react` as an optional peer dependency.

The shipped React declaration files (`useQuery`, `ApolloProvider`, `useSuspenseQuery` and the rest of the React surface) reference React types, but the typings package was never declared. Hoisted `node_modules` layouts resolve it by accident; strict layouts such as pnpm's isolated linker do not, because TypeScript resolves a package's imports from where that package physically lives. React types then degraded to `any`, producing implicit-any errors in consumer code.

npm has no per-subpath peer dependencies, so this is declared at the package level even though only the React entry points need it. It is optional, so core-only and server-side consumers get no unmet peer warning. `@types/react-dom` is not needed: no shipped `.d.ts` references react-dom types.
