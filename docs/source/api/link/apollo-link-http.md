---
title: HTTP Link
sidebar_title: HTTP
description: Get GraphQL results over a network using HTTP fetch.
---

> We recommend reading [Apollo Link overview](./introduction/) before learning about individual links.

`HttpLink` is a terminating link that sends a GraphQL operation to a remote endpoint over HTTP. Apollo Client uses `HttpLink` by default when you provide the `uri` option to the `ApolloClient` constructor.

`HttpLink` supports both POST and GET requests, and you can configure HTTP options on a per-operation basis. You can use these options for authentication, persisted queries, dynamic URIs, and other granular updates.

## Usage

Import the `HttpLink` class and initialize a link like so:

```js
import { HttpLink } from '@apollo/client';

const link = new HttpLink({
  uri: "http://localhost:4000/graphql"
  // Additional options
});
```

## `HttpLink` constructor options

The `HttpLink` constructor takes an options object that can include the fields below. Note that you can also override some of these options on a per-operation basis using the [operation context](#context-options).

<table class="field-table">
  <thead>
    <tr>
      <th>Name /<br/>Type</th>
      <th>Description</th>
    </tr>
  </thead>

<tbody>
<tr>
<td>

###### `uri`

`String` or `Function`
</td>
<td>

The URL of the GraphQL endpoint to send requests to. Can also be a function that accepts an `Operation` object and returns the string URL to use for that operation.

The default value is `/graphql`.
</td>
</tr>


<tr>
<td>

###### `includeExtensions`

`Boolean`
</td>
<td>

If true, includes the `extensions` field in operations sent to your GraphQL endpoint.

The default value is `false`.
</td>
</tr>


<tr>
<td>

###### `fetch`

`Function`
</td>
<td>

A function to use instead of calling the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) directly when sending HTTP requests to your GraphQL endpoint. The function must conform to the signature of `fetch`.

By default, the Fetch API is used unless it isn't available in your runtime environment.

See [Customizing `fetch`](#customizing-fetch).
</td>
</tr>


<tr>
<td>

###### `headers`

`Object`
</td>

<td>

An object representing headers to include in every HTTP request, such as `{Authentication: 'Bearer abc123'}`.
</td>
</tr>


<tr>
<td>

###### `credentials`

`String`
</td>

<td>

The credentials policy to use for each `fetch` call. Can be `omit`, `include`, or `same-origin`.
</td>
</tr>


<tr>
<td>

###### `fetchOptions`

`Object`
</td>

<td>

An object containing options to use for each call to `fetch`. If a particular option is not included in this object, the default value of that option is used.

Note that if you set `fetchOptions.method` to `GET`, `HttpLink` follows [standard GraphQL HTTP GET encoding](http://graphql.org/learn/serving-over-http/#get-request).

[See available options](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
</td>
</tr>


<tr>
<td>

###### `useGETForQueries`

`Boolean`
</td>

<td>

If `true`, the link uses an HTTP GET request when sending query operations to your GraphQL endpoint. Mutation operations continue to use `POST` requests. If you want _all_ operations to use `GET` requests, set [`fetchOptions.method`](#fetchoptions) instead.

The default value is `false`.
</td>
</tr>

</tbody>
</table>


## Context options

`HttpLink` checks the [current operation's `context`](./introduction/#managing-context) for certain values before sending its request to your GraphQL endpoint. Previous links in the link chain can set these values to customize the behavior of `HttpLink` for each operation.

> Some of these values can also be provided as options to [the `HttpLink` constructor](#httplink-constructor-options). If a value is provided to both, the value in the `context` takes precedence.

<table class="field-table">
  <thead>
    <tr>
      <th>Name /<br/>Type</th>
      <th>Description</th>
    </tr>
  </thead>

<tbody>
<tr>
<td>

###### `uri`

`String` or `Function`
</td>
<td>

The URL of the GraphQL endpoint to send requests to. Can also be a function that accepts an `Operation` object and returns the string URL to use for that operation.

The default value is `/graphql`.
</td>
</tr>


<tr>
<td>

###### `headers`

`Object`
</td>

<td>

An object representing headers to include in the HTTP request, such as `{Authentication: 'Bearer abc123'}`.
</td>
</tr>


<tr>
<td>

###### `credentials`

`String`
</td>

<td>

The credentials policy to use for this `fetch` call. Can be `omit`, `include`, or `same-origin`.
</td>
</tr>


<tr>
<td>

###### `fetchOptions`

`Object`
</td>

<td>

An object containing options to use for this call to `fetch`. If a particular option is not included in this object, the default value of that option is used.

Note that if you set `fetchOptions.method` to `GET`, `HttpLink` follows [standard GraphQL HTTP GET encoding](http://graphql.org/learn/serving-over-http/#get-request).

[See available options](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
</td>
</tr>


<tr>
<td>

###### `http`

`Object`
</td>
<td>

An object that configures advanced `HttpLink` functionality, such as support for persisted queries. Options are listed in [`http` option fields](#http-option-fields).

</td>
</tr>

</tbody>
</table>

### `http` option fields

<table class="field-table">
  <thead>
    <tr>
      <th>Name /<br/>Type</th>
      <th>Description</th>
    </tr>
  </thead>

<tbody>
<tr>
<td>

###### `includeExtensions`

`Boolean`
</td>
<td>

If true, includes the `extensions` field in operations sent to your GraphQL endpoint.

The default value is `false`.
</td>
</tr>

<tr>
<td>

###### `includeQuery`

`Boolean`
</td>
<td>

If `false`, the GraphQL query string is _not_ included in the request. Set this option if you're sending a request that uses a [persisted query](./persisted-queries/).

The default value is `true`.
</td>
</tr>

</tbody>
</table>

## Operation results

After your GraphQL endpoint (successfully) responds with the result of the sent operation, `HttpLink` sets it as the `response` field of the operation `context`. This enables each previous link in your link chain to interact with the response before it's returned.


## Handling errors

`HttpLink` distinguishes between client errors, server errors, and GraphQL errors. You can add the [`onError` link](./apollo-link-error) to your link chain to handle these errors via a [callback](./apollo-link-error#options).

The following types of errors can occur:

| Error          | Description | Callback | Error Type         |
| -------------- | ------------| :------: | ------------------ |
| Client Parse   | The request body is not serializable, for example due to a circular reference. |`error`  | `ClientParseError` |
| Server Parse   | The server's response cannot be parsed ([response.json()](https://developer.mozilla.org/en-US/docs/Web/API/Body/json)) | `error`  | `ServerParseError` |
| Server Network | The server responded with a non-2xx HTTP code. | `error`  | `ServerError`      |
| Server Data    | The server's response didn't contain `data` or `errors`. | `error`  | `ServerError`      |
| GraphQL Error  | Resolving the GraphQL operation resulted in at least one error, which is present in the `errors` field. |  `next`  | `Object`           |

Because many server implementations can return a valid GraphQL result on a server network error, the thrown `Error` object contains the parsed server result. A server data error also receives the parsed result.

All error types inherit the `name`, `message`, and nullable `stack` properties from the generic javascript [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error):

```js
//type ClientParseError
{
  parseError: Error;                // Error returned from response.json()
};

//type ServerParseError
{
  response: Response;               // Object returned from fetch()
  statusCode: number;               // HTTP status code
  bodyText: string                  // text that was returned from server
};

//type ServerError
{
  result: Record<string, any>;      // Parsed object from server response
  response: Response;               // Object returned from fetch()
  statusCode: number;               // HTTP status code
};
```

## Customizing `fetch`

You can provide the [`fetch` option](#fetch) to the `HttpLink` constructor to enable many custom networking needs. For example, you can modify the request based on calculated headers or calculate the endpoint URI based on the operation's details.

If you're targeting an environment that doesn't provide the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) (such as older browsers or the server) you can provide a different implementation of `fetch`. We recommend [`unfetch`](https://github.com/developit/unfetch) for older browsers and [`node-fetch`](https://github.com/bitinn/node-fetch) for running in Node.

### Custom auth

This example adds a custom `Authorization` header to every request before calling `fetch`:

```js
const customFetch = (uri, options) => {
  const { header } = Hawk.client.header(
    "http://example.com:8000/resource/1?b=1&a=2",
    "POST",
    { credentials: credentials, ext: "some-app-data" }
  );
  options.headers.Authorization = header;
  return fetch(uri, options);
};

const link = new HttpLink({ fetch: customFetch });
```

### Dynamic URI

This example customizes the endpoint URL's query parameters before calling `fetch`:

```js
const customFetch = (uri, options) => {
  const { operationName } = JSON.parse(options.body);
  return fetch(`${uri}/graph/graphql?opname=${operationName}`, options);
};

const link = new HttpLink({ fetch: customFetch });
```
