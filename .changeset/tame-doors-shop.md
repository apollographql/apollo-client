---
"@apollo/client": major
---

Remove workarounds for streaming with non-WhatWG response bodies to reduce bundle size.

This removes support for `fetch` implementations that return Node Streams, Async Iterators or Blob instances as `Response.body`.

In the WhatWG Fetch specification, [`Response.body`](https://fetch.spec.whatwg.org/#body) is specified as a WhatWG [ReadableStream](https://streams.spec.whatwg.org/#readablestream).

At this point in time, this is natively supported in browsers, `node` and React Native.

If you are using an older `fetch` polyfill that deviates from the spec, this might not be compatible - for example, [node-fetch](https://github.com/node-fetch/node-fetch?tab=readme-ov-file#interface-body) returns a node `Readable` instead of a `ReadableStream`.
In those cases, please switch to a compatible alternative such as the `node`-native `fetch`, or `undici`.
