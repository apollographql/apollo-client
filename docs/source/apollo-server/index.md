---
title: Installing
order: 301
description: How to install Apollo Server
---

Apollo Server is a community driven, hackable GraphQL server for production use. You can use it with Express, Connect, HAPI and Koa.


```txt
npm install apollo-server
```

Apollo Server differs from express-graphql in the following ways:
- It has a simpler interface and allows only POST requests, which makes it a bit easier to reason about what's going on.
- Apollo Server serves GraphiQL on a separate route, giving you more flexibility to decide when and how to expose it.
- Apollo Server supports query batching which can help reduce load on your server.
- Apollo Server has built-in support for query whitelisting, which can make your app faster and your server more secure.
