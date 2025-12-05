---
"@apollo/client": minor
---

Don't set the fallback value of a `@client` field to `null` when a `read` function is defined. Instead the `read` function will be called with an `existing` value of `undefined` to allow default arguments to be used to set the returned value.

When a `read` function is not defined nor is there a defined resolver for the field, warn and set the value to `null` only in that instance.
