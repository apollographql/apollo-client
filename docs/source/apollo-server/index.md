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
- It has a simpler interface and allows only POST requests, which makes the server easier to understand and secure.
- Apollo Server serves GraphiQL on a separate route, which reduces complexity.
- Apollo Server supports query batching which can make your app faster by reducing roundtrips.
- Apollo Server has built-in support for query whitelisting, which can make your app faster and your server more secure.
