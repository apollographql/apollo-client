---
"@apollo/client": patch
---

Guarantee each subscription message results in a re-render.

If two subscription messages are delivered at _exactly_ the same time, automatic batching in React 18 prevents the first message from being rendered to the screen since the two synchronous calls to `setResult` are batched resulting in a skipped render of the first message, so we use `flushSync` to guarantee a re-render for each.
