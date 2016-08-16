---
title: Sending requests
order: 303
description: How to send requests to Apollo Server
---

Apollo Server accepts only JSON-encoded POST requests. A valid request must contain either a `query` or an `operationName` (or both, in case of a named query), and may include `variables.` For example:

```js
{
  "query": "query aTest{ test(who: $arg1) }",
  "operationName": "aTest",
  "variables": { "arg1": "me" }
}
```

Variables can be an object or a JSON-encoded string. I.e. the following is equivalent to the previous query:

```js
{
  "query": "query aTest{ test(who: $arg1) }",
  "operationName": "aTest",
  "variables": "{ \"arg1\": \"me\" }"
}
```

A batch of queries can be sent by simply sending a JSON-encoded array of queries, e.g.

```js
[
  { "query": "{ testString }" },
  { "query": "query q2{ test(who: \"you\" ) }" }
]
```

If a batch of queries is sent, the response will be an array of GraphQL responses.

If Apollo Server is running under a different origin than your client, you will need to enable CORS support on the server, or proxy the GraphQL requests through a web server under the main origin.
