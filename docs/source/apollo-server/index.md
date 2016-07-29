---
title: Installing
order: 301
description: How to install Apollo Server
---

Apollo Server is a GraphQL server for Node.js built to be run in production. It has integrations for Express, Connect, HAPI and Koa.


```txt
npm install apollo-server
```

Apollo Server comes with a set of features that make it ideal for running in production:
- Simple external interface: reduces potential attack surface by only allowing one request format
- Separation of concerns: reduces complexity (eg. by serving GraphiQL on a separate path)
- Query batching: makes the server more performant by reducing roundtrips
- Query whitelisting: increases security, reduces bandwidth, saves parsing and validation time
