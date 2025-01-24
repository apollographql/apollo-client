---
"@apollo/client": major
---

Return `undefined` from `observableQuery.variables` and `observableQuery.options.variables` instead of an empty object when calling `watchQuery` without variables. This aligns the runtime behavior with the TypeScript type of `TVariables | undefined`.
