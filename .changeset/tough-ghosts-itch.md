---
"@apollo/client": patch
---

Fix: unblocks support for defer in mutations

If the `@defer` directive is present in the document passed to `mutate`, the Promise will resolve with the final merged data after the last multipart chunk has arrived in the response.
