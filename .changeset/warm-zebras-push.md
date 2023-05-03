---
"@apollo/client": patch
---

Fix type signature of `ServerError`.

In <3.7 `HttpLink` and `BatchHttpLink` would return a `ServerError.message` of e.g. `"Unexpected token 'E', \"Error! Foo bar\" is not valid JSON"` and a `ServerError.result` of `undefined` in the case where a server returned a >= 300 response code with a response body containing a string that could not be parsed as JSON.

In >=3.7, `message` became e.g. `Response not successful: Received status code 302` and `result` became the string from the response body, however the type in `ServerError.result` was not updated to include the `string` type, which is now properly reflected.
