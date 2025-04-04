---
"@apollo/client": minor
---

Add ability to specify a default `delay` for all mocked responses passed to `MockLink`. If an explicit delay is not provided in the mock configuration, the default delay will be used instead.

```ts
new MockLink(
  [
    // Use the default delay
    {
      request: { query },
      result: { data: { greeting: 'Hello' }},
    },
    {
      request: { query },
      result: { data: { greeting: 'Hello' }},
      // Override the default for this mock
      delay: 10
    },
  ],
  {
    defaultOptions: {
      // Use a default delay of 20ms for all mocks without a specified delay
      delay: 20,

      // altenatively use a callback which will be executed for each mock
      delay: () => getRandomNumber(),

      // or use the built-in `realisticDelay`. This is the default
      delay: realisticDelay(),
    }
  }
);
```
