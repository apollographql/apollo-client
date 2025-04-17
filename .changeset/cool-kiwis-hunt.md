---
"@apollo/client": minor
---

Add ability to specify message formatter for `CombinedGraphQLErrors` and `CombinedProtocolErrors`. To provide your own message formatter, override the static `formatMessage` property on these classes.

```ts
CombinedGraphQLErrors.formatMessage = (errors, { result, defaultFormatMessage }) => {
  return "Some formatted message"
};

CombinedProtocolErrors.formatMessage = (errors, { defaultFormatMessage }) => {
  return "Some formatted message"
};
```
