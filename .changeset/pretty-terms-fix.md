---
"@apollo/client": patch
---

Remove newly exported response iterator helpers that caused problems on some installs where `@types/node` was not available.

**IMPORTANT**

The following exports were added in version 3.8.0 that are removed with this patch.

- `isAsyncIterableIterator`
- `isBlob`
- `isNodeReadableStream`
- `isNodeResponse`
- `isReadableStream`
- `isStreamableBlob`
