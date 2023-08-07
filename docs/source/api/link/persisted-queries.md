---
title: Persisted Queries Link
description: Reject unrecognized operations while minimizing request latency.
---

## Problems to solve

Unlike REST APIs that use a fixed URL to load data, GraphQL provides a rich query language that can be used to express the shape of application data requirements. This is a marvelous advancement in technology, but it comes at a cost: GraphQL query strings are often much longer than REST URLS—in some cases by many kilobytes.

In practice we've seen GraphQL query sizes ranging well above 10 KB *just for the query text*. This is significant overhead when compared with a simple URL of 50-100 characters. When paired with the fact that the uplink speed from the client is typically the most bandwidth-constrained part of the chain, large queries can become bottlenecks for client performance. Additionally, large queries can be potentially malicious requests, which may necessitate securing your graph against them.

## Solutions

Apollo supports two separate but related features called **persisted queries** and **automatic persisted queries** (APQs).
With both features, clients can execute a GraphQL operation by sending an operation's ID instead of the entire operation string. An operation's ID is the SHA256 hash of the full string. Querying by ID can significantly reduce latency and bandwidth usage for very large operation strings.

### Differences between persisted queries and APQ

The persisted queries feature requires operations to be preregistered in a **persisted query list** (**PQL**). 
This allows the PQL to act as a safelist of trusted operations made by your first-party apps. As such, persisted queries is a security feature as much as a performance one.

With APQs, if the server can't find the operation ID the client provides, it asks the client to send the ID and the operation string so it can store them mapped together for future lookups. During this request, the backend also fulfills the data request.

If you _only_ want to improve request latency and bandwidth usage, APQ addresses your use case. If you _also_ want to secure your supergraph with operation safelisting, you should preregister trusted operations in a PQL.

For more details on differences between persisted queries and APQ, see the [GraphOS persisted queries documentation](/graphos/operations/persisted-queries#differences-from-automatic-persisted).

## Implementation steps

Because persisted queries requires you to preregister trusted operations, it has additional implementation steps:

1. **For persisted queries only**: Generate and publish operation manifests
2. **For persisted queries only**: Publish operation manifests
3. **For both persisted queries and APQs**: Enable persisted queries on `ApolloClient`

The rest of this article details these steps.

Persisted queries also requires you to create and link a PQL, and to configure your router. For more information on the other configuration aspects of persisted queries, see the [GraphOS persisted queries documentation](/graphos/operations/persisted-queries).

### 0. Requirements

Persisted queries is currently in [preview](/resources/product-launch-stages#preview) and has the following requirements:
- Apollo Client Web (v3.2.0+)
- The [`@apollo/generate-persisted-query-manifest` package](https://www.npmjs.com/package/@apollo/generate-persisted-query-manifest)
- The [`@apollo/persisted-query-lists` package](https://www.npmjs.com/package/@apollo/persisted-query-lists)
- [Apollo Router](/router) (v1.25.0+)
- [GraphOS Enterprise plan](/graphos/enterprise/)

You can use APQ with the following versions of Apollo Client Web, Apollo Server, and Apollo Router:
- Apollo Client Web (v3.2.0+)
- [Apollo Server](/apollo-server/) (v1.0.0+)
- [Apollo Router](/router) (v0.1.0+)

> **Note:** You can use _either_ Apollo Server _or_ Apollo Router for APQs. They don't need to be used together.

### 1. Generate operation manifests

> **This step is only required for persisted queries, not APQ.**

If you haven't already, install the [`@apollo/generate-persisted-query-manifest`](https://www.npmjs.com/package/@apollo/generate-persisted-query-manifest) package as a dev dependency:

```bash
npm install --save-dev @apollo/generate-persisted-query-manifest
```

Then use its CLI to extract queries from your app:

```bash
npx generate-persisted-query-manifest
```

To automatically update the manifest for each new app release, you can include this command in your CI/CD pipeline.

You can optionally create a configuration file in the root of your project to override default options. See the [package's Readme](https://www.npmjs.com/package/@apollo/generate-persisted-query-manifest) for further information.

### 2. Publish manifests to the PQL

<blockquote>

**This step is only required for persisted queries, not APQ.**

Ensure your Rover CLI version is `0.17.2` or later. Previous versions of Rover don't support publishing operations to a PQL.
[Download the latest version.](/rover/getting-started/)

</blockquote>

If you want to preregister your manifest as a safelist of trusted operations, you need to publish it to a PQL using the [Rover CLI](/rover/):

```bash title="Example command"
rover persisted-queries publish my-graph@my-variant \
  --manifest ./persisted-query-manifest.json
```

- Replace `my-graph@my-variant` with the **graph ref** of _any_ variant your PQL is [linked to](/graphos/operations/persisted-queries#12-link-the-pql-to-variants). Your platform team can provide this for you.
    - Graph refs have the format `graph-id@variant-name`.
- For the `--manifest` option, provide the path to the manifest you want to publish.

**The above command does the following:**

1. It publishes all operations in the provided manifest file to the PQL linked to the specified variant.
    - Publishing a manifest to a PQL is additive. Any _existing_ entries in the PQL remain.
    - If you publish an operation with the same `id` but different details from an existing entry in the PQL, the entire publish command fails with an error.

2. It updates any _other_ variants that the PQL is applied to so that routers associated with those variants can fetch their updated PQL.

As with manifest generation, you can execute this command in your CI/CD pipeline to publish new operations as part of your app release process.

### 3. Enable persisted queries on `ApolloClient`

To send operations as IDs rather than full operation strings, you use the **persisted queries** Apollo Link. The implementation details depend on whether you're using persisted queries or APQs.

Both require a SHA-256 based hashing function and neither includes one by default, to avoid forcing one as a dependency. Developers should pick the most appropriate SHA-256 function (sync or async) for their needs/environment. If you don't already have one available in your application, you need to install one separately. For example:

`npm install crypto-hash`

#### APQ implementation link

The **persisted queries** Apollo Link for APQs is included in the `@apollo/client` package:

```bash
npm install @apollo/client
```

The link requires using ApolloClient's `HttpLink`. The easiest way to use them together is to `concat` them into a single link.

```js
import { HttpLink, InMemoryCache, ApolloClient } from "@apollo/client";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { sha256 } from 'crypto-hash';

const httpLink = new HttpLink({ uri: "/graphql" });
const persistedQueriesLink = createPersistedQueryLink({ sha256 });
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: persistedQueriesLink.concat(httpLink),
});
```

Thats it! Now your client will start sending query signatures instead of the full text resulting in improved network performance.

#### `createPersistedQueryLink` Options

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

#### Persisted queries

A persisted queries (as opposed to APQ ) implementation also uses the persisted queries link, but requires some additional tooling.

Install the [`@apollo/persisted-query-lists`](https://www.npmjs.com/package/@apollo/persisted-query-lists) package:

```bash
npm install @apollo/persisted-query-lists
```

This package contains an Apollo Link that can be used to verify your persisted queries against a manifest as well as helpers that work with the persisted queries link.

##### `generatePersistedQueryIdsAtRuntime` helper

You pass the `generatePersistedQueryIdsAtRuntime` helper function to the Persisted Query Link to generate query hashes at runtime without the use of a manifest file. This differs from the default behavior of the Persisted Query Link by disabling automatic registration of persisted queries and sorting top-level definitions to mimic the behavior of the manifest file. See [`generatePersistedQueryIdsFromManifest`](#generatePersistedQueryIdsFromManifest-helper) if you are able to integrate manifest file generation into your app's build process.

```js
import { generatePersistedQueryIdsAtRuntime } from "@apollo/persisted-query-lists";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { sha256 } from "crypto-hash";

const persistedQueryLink = createPersistedQueryLink(
  generatePersistedQueryIdsAtRuntime({ sha256 }),
);
```

This function won't work properly if you pass the `createOperationId` config option to @apollo/generate-persisted-query-manifest.

##### `generatePersistedQueryIdsFromManifest` helper

You can pass the `generatePersistedQueryIdsFromManifest` helper function passed to the Persisted Query Link to read from your manifest configuration to get the persisted query ID. Note that this function completely ignores the body in the manifest: it just looks for an operation whose name matches the operation your code is trying to execute, and uses its id.

```js
import { generatePersistedQueryIdsFromManifest } from "@apollo/persisted-query-lists";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";

const persistedQueryLink = createPersistedQueryLink(
  generatePersistedQueryIdsFromManifest({
    loadManifest: () => import("./path/to/persisted-query-manifest.json"),
  }),
);
```

#### `createPersistedQueryManifestVerificationLink` helper

An Apollo Link that verifies that queries sent to your server can be matched to your manifest configuration. See the @apollo/generate-persisted-query-manifest package to learn how to generate the manifest file.

NOTE: This link is not a terminating link and will forward the operation through the link chain.

```js
import { createPersistedQueryManifestVerificationLink } from "@apollo/persisted-query-lists";

const verificationLink = createPersistedQueryManifestVerificationLink({
  loadManifest: () => import("./path/to/persisted-query-manifest.json"),
  onVerificationFailed: (details) => {
    console.warn(details.reason);
  },
});
```

## Apollo Studio

Apollo Studio supports receiving and fulfilling APQs. Simply adding this link into your client app will improve your network response times when using Apollo Studio.

### Protocol

APQs are made up of three parts: the query signature, error responses, and the negotiation protocol.

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

