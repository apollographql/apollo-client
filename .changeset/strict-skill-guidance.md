---
"@apollo/client": patch
---

Update the Apollo Client agent skill with stricter guidance for queries and fragments:

- Only the route component calls a query hook. The skill lists the permitted exceptions.
- Queries are never shared between routes or put in reusable custom hooks.
- Each component owns its fragment and reads its data with `useFragment` or `useSuspenseFragment`.
- Fragment types use `FragmentType<typeof FRAGMENT>`. The skill includes setup instructions for data masking with GraphQL Codegen and a codemod to migrate existing apps.
- Mutations are called in the component where the user interaction happens, without wrapper hooks.
- A new fetch policy decision list. Data that a mutation changed is fixed in the cache, not with a different fetch policy.
- Examples check `dataState`, and several incorrect examples are fixed.
