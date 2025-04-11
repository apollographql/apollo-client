---
"@apollo/client": minor
---

Introduce a new `realisticDelay` helper function for use with the `delay` callback for mocked responses used with `MockLink`. `realisticDelay` will generate a random value between 20 and 50ms to provide an experience closer to unpredictable network latency. `realisticDelay` can be configured with a `min` and `max` to set different thresholds if the defaults are not sufficient.

```ts
import { realisticDelay } from '@apollo/client/testing';

new MockLink([
  {
    request: { query },
    result: { data: { greeting: 'Hello' }},
    delay: realisticDelay()
  },
  {
    request: { query },
    result: { data: { greeting: 'Hello' }},
    delay: realisticDelay({ min: 10, max: 100 })
  },
]);
```
