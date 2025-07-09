---
"@apollo/client": minor
---

Add a static `is` method to error types defined by Apollo Client. `is` makes it simpler to determine whether an error is a specific type, which can be helpful in cases where you'd like to narrow the error type in order to use specific properties from that error.

This change applies to the following error types:
- `CombinedGraphQLErrors`
- `CombinedProtocolErrors`
- `ServerError`
- `ServerParseError`
- `UnconventionalError`

**Example**

```ts
import { CombinedGraphQLErrors } from "@apollo/client";

if (CombinedGraphQLErrors.is(error)) {
  console.log(error.message);
  error.errors.forEach((graphQLError) => console.log(graphQLError.message))
}
```

