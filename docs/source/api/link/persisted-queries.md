---
title: Persisted Queries Link
sidebar_title: Persisted Queries
description: Replace full queries with generated ID's to reduce bandwidth.
---

## Problem to solve

Unlike REST APIs that use a fixed URL to load data, GraphQL provides a rich query language that can be used to express the shape of application data requirements. This is a marvelous advancement in technology, but it comes at a cost: GraphQL query strings are often much longer than REST URLS — in some cases by many kilobytes.

In practice we've seen GraphQL query sizes ranging well above 10 KB *just for the query text*. This is significant overhead when compared with a simple URL of 50-100 characters. When paired with the fact that the uplink speed from the client is typically the most bandwidth-constrained part of the chain, large queries can become bottlenecks for client performance.

Automatic Persisted Queries solves this problem by sending a generated ID instead of the query text as the request.

For more information about this solution, read [this article announcing Automatic Persisted Queries](https://www.apollographql.com/blog/improve-graphql-performance-with-automatic-persisted-queries-c31d27b8e6ea/).

## How it works

1. When the client makes a query, it will optimistically send a short (64-byte) cryptographic hash instead of the full query text.
2. If the backend recognizes the hash, it will retrieve the full text of the query and execute it.
3. If the backend doesn't recognize the hash, it will ask the client to send the hash and the query text so it can store them mapped together for future lookups. During this request, the backend will also fulfill the data request.

This library is a client implementation for use with Apollo Client by using custom Apollo Link.

## Installation

This link is included in the `@apollo/client` package:

`npm install @apollo/client`

If you do not already have a SHA-256 based hashing function available in your application, you will need to install one separately. For example:

`npm install crypto-hash`

This link doesn't include a SHA-256 hash function by default, to avoid forcing one as a dependency. Developers should pick the most appropriate SHA-256 function (sync or async) for their needs/environment.

## Usage

The persisted query link requires using the `HttpLink`. The easiest way to use them together is to `concat` them into a single link.

```js
import { HttpLink, InMemoryCache, ApolloClient } from "@apollo/client";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { sha256 } from 'crypto-hash';

const httpLink = new HttpLink({ uri: "/graphql" });
const persistedQueriesLink = createPersistedQueryLink({ sha256 });
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: persistedQueriesLink.concat(httpLink);
});
```

Thats it! Now your client will start sending query signatures instead of the full text resulting in improved network performance!

#### Options

The `createPersistedQueryLink` function takes a configuration object:

- `sha256`: a SHA-256 hashing function. Can be sync or async. Providing a SHA-256 hashing function is required, unless you're defining a fully custom hashing approach via `generateHash`.
- `generateHash`: an optional function that takes the query document and returns the hash. If provided this custom function will override the default hashing approach that uses the supplied `sha256` function. If not provided, the persisted queries link will use a fallback hashing approach leveraging the `sha256` function.
- `useGETForHashedQueries`: set to `true` to use the HTTP `GET` method when sending the hashed version of queries (but not for mutations). `GET` requests are not compatible with `@apollo/client/link/batch-http`.
> If you want to use `GET` for non-mutation queries whether or not they are hashed, pass `useGETForQueries: true` option to `HttpLink` instead. If you want to use `GET` for all requests, pass `fetchOptions: {method: 'GET'}` to `HttpLink`.
- `disable`: a function which takes an `ErrorResponse` (see below) and returns a boolean to disable any future persisted queries for that session. This defaults to disabling on `PersistedQueryNotSupported` or a 400 or 500 http error.

**ErrorResponse**

The argument that the optional `disable` function is given is an object with the following keys:

- `operation`: The Operation that encountered an error (contains `query`, `variables`, `operationName`, and `context`).
- `response`: The Execution of the response (contains `data` and `errors` as well `extensions` if sent from the server).
- `graphQLErrors`: An array of errors from the GraphQL endpoint.
- `networkError`: Any error during the link execution or server response.

*Note*: `networkError` is the value from the downlink's `error` callback. In most cases, `graphQLErrors` is the `errors` field of the result from the last `next` call. A `networkError` can contain additional fields, such as a GraphQL object in the case of a failing HTTP status code from `@apollo/link/http`. In this situation, `graphQLErrors` is an alias for `networkError.result.errors` if the property exists.

## Apollo Studio

Apollo Studio supports receiving and fulfilling Automatic Persisted Queries. Simply adding this link into your client app will improve your network response times when using Apollo Studio.

### Protocol

Automatic Persisted Queries are made up of three parts: the query signature, error responses, and the negotiation protocol.

**Query Signature**

The query signature for Automatic Persisted Queries is sent through the `extensions` field of a request from the client. This is a transport independent way to send extra information along with the operation.

```js
{
  operationName: 'MyQuery',
  variables: null,
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: hashOfQuery
    }
  }
}
```

When sending an Automatic Persisted Query, the client omits the `query` field normally present, and instead sends an extension field with a `persistedQuery` object as shown above. The hash algorithm defaults to a `sha256` hash of the query string.

If the client needs to register the hash, the query signature will be the same but include the full query text like so:

```js
{
  operationName: 'MyQuery',
  variables: null,
  query: `query MyQuery { id }`,
  extensions: {
    persistedQuery: {
      version: 1,
      sha256Hash: hashOfQuery
    }
  }
}
```

This should only happen once across all clients when a new query is introduced into your application.

**Error Responses**

When the initial query signature is received by a backend, if it is unable to find the hash previously stored, it will send back the following response signature:

```js
{
  errors: [
    { message: 'PersistedQueryNotFound' }
  ]
}
```

If the backend doesn't support Automatic Persisted Queries, or does not want to support it for that particular client, it can send back the following which will tell the client to stop trying to send hashes:

```
{
  errors: [
    { message: 'PersistedQueryNotSupported' }
  ]
}
```

**Negotiation Protocol**

In order to support Automatic Persisted Queries, the client and server must follow the negotiation steps as outlined here:

*Happy Path*
1. Client sends query signature with no `query` field
2. Server looks up query based on hash, if found, it resolves the data
3. Client receives data and completes request

*Missing hash path*
1. Client sends query signature with no `query` field
2. Server looks up query based on hash, none is found
3. Server responds with NotFound error response
4. Client sends both hash and query string to Server
5. Server fulfills response and saves query string + hash for future lookup
6. Client receives data and completes request

### Build time generation

If you want to avoid hashing in the browser, you can use a build script to include the hash as part of the request, then pass a function to retrieve that hash when the operation is run. This works well with projects like [GraphQL Persisted Document Loader](https://github.com/leoasis/graphql-persisted-document-loader) which uses webpack to generate hashes at build time.

If you use the above loader, you can pass `{ generateHash: ({ documentId }) => documentId }` to the `createPersistedQueryLink` call.
