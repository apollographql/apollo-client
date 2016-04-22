---
title: Mocking
order: 206
description: Mock your GraphQL data based on a schema.
---

<h3 id="mockServer" title="mockServer">
  mockServer(schema, mocks = {}, preserveResolvers = false)
</h3>

For more information about how to use the `mockServer` function, see the [Medium Post about mocking](https://medium.com/apollo-stack/mocking-your-server-with-just-one-line-of-code-692feda6e9cd).

<h3 id="addMocksToSchema" title="addMocksToSchema">
  addMocksToSchema(schema, mocks = {}, preserveResolvers = false)
</h3>

`addMocksToSchema` is the function that `mockServer` uses under the hood. Given an instance of GraphQLSchema and a mock object, it modifies the schema in place to return mock data for any valid query that is sent to the server. If `mocks` is not passed, the defaults will be used for each of the scalar types. If `preserveResolvers` is set to `true`, existing resolve functions will not be overwritten to provide mock data. This can be used to mock some parts of the server and not others.
