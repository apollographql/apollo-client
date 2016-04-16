---
title: Documentation for graphql-tools
order: 203
description: These are Apollo Docs!!
---

While `apolloServer` can be used as an express middleware, graphql-tools exports all the functions that `apolloServer` uses internally, so they can be used separately with any GraphQL-JS schema. This section documents all the functions that graphql-tools exports, and explains how they can be used.

## Express middleware

* apolloServer

## Schema creation

* createSchema

## Resolve functions

* addResolversToSchema
* addSchemaLevelResolver

## Mocking

* mockServer
* addMocksToSchema

## Logging and performance profiling

* Logger
* addProfilingToSchema

## Data Loaders

* attachLoadersToContext

## Error handling

* forbidUndefinedResolve
