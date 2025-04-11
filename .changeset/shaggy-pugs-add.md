---
"@apollo/client": minor
---

Add ability to specify a default `delay` for all mocked responses passed to `MockLink`. This `delay` can be configured globally (all instances of `MockLink` will use the global defaults), or per-instance (all mocks in a single instance will use the defaults). A `delay` defined on a single mock will supercede all default delays. Per-instance defaults supercede global defaults.

**Global defaults**

```ts
MockLink.defaultOptions = {
  // Use a default delay of 20ms for all mocks in all instances without a specified delay
  delay: 20,

  // altenatively use a callback which will be executed for each mock
  delay: () => getRandomNumber(),

  // or use the built-in `realisticDelay`. This is the default
  delay: realisticDelay(),
}
```

**Per-instance defaults**

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
