---
title: Retry Link
description: Attempt an operation multiple times if it fails due to network or server errors.
---

## Overview

`@apollo/client/link/retry` can be used to retry an operation a certain amount of times. This comes in handy when dealing with unreliable communication situations, where you would rather wait longer than explicitly fail an operation. `@apollo/client/link/retry` provides exponential backoff, and jitters delays between attempts by default.

> **Note:** It does not currently handle retries for GraphQL errors in the response, only for network errors; the `onError` link can be used to retry an operation after a GraphQL error. For more information, see the [Error handling documentation](/react/data/error-handling/#on-graphql-errors).

An example use case is to hold on to a request while a network connection is offline, and retry until it comes back online.

```js
import { RetryLink } from "@apollo/client/link/retry";

const link = new RetryLink();
```

## Options

The standard retry strategy provides exponential backoff with jittering, and takes the following options, grouped into `delay` and `attempt` strategies:

### options.delay

| Option | Description |
| - | - |
| `delay.initial` | The number of milliseconds to wait before attempting the first retry. |
| `delay.max` | The maximum number of milliseconds that the link should wait for any retry. |
| `delay.jitter` | Whether delays between attempts should be randomized. |

### options.attempts

| Option | Description |
| - | - |
| `attempts.max` | The max number of times to try a single operation before giving up. |
| `attempts.retryIf` | A predicate function that can determine whether a particular response should be retried. |

### Default configuration

The default configuration is equivalent to:

```ts
new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true
  },
  attempts: {
    max: 5,
    retryIf: (error, _operation) => !!error
  }
});
```

## Avoiding thundering herd

Starting with `initialDelay`, the delay of each subsequent retry is increased exponentially, meaning it's multiplied by 2 each time. For example, if `initialDelay` is 100, additional retries will occur after delays of 200, 400, 800, etc.

With the `jitter` option enabled, delays are randomized anywhere between 0ms (instant), and 2x the configured delay. This way you get the same result on average, but with random delays.

These two features are combined to help alleviate [the thundering herd problem](https://en.wikipedia.org/wiki/Thundering_herd_problem), by distributing load during major outages. Without these strategies, when your server comes back up it will be hit by all of your clients at once, possibly causing it to go down again.

## Custom strategies

Instead of the options object, you may pass a function for `delay` and/or `attempts`, which implement custom strategies for each. In both cases the function is given the same arguments (`count`, `operation`, `error`).

The `attempts` function should return a `boolean` (or a `Promise` which resolves to a `boolean`) indicating whether the response should be retried. If yes, the `delay` function is then called, and should return the number of milliseconds to delay by.

```js
import { RetryLink } from "@apollo/client/link/retry";

const link = new RetryLink({
  attempts: (count, operation, error) => {
    return !!error && operation.operationName != 'specialCase';
  },
  delay: (count, operation, error) => {
    return count * 1000 * Math.random();
  },
});
```
