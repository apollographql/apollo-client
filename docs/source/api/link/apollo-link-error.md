---
title: Error Link
description: Handle and inspect errors in your GraphQL network stack.
---

> We recommend reading [Apollo Link overview](./introduction/) before learning about individual links.

Use the `onError` link to perform custom logic when a [GraphQL or network error](../../data/error-handling/) occurs. You pass this link a function that's executed if an operation returns one or more errors:

```js
import { onError } from "@apollo/client/link/error";

// Log any GraphQL errors or network error that occurred
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  if (networkError) console.log(`[Network error]: ${networkError}`);
});
```

This function is called after the GraphQL operation completes and execution is moving back _up_ your [link chain](./introduction/#handling-a-response). The function should not return a value unless you want to [retry the operation](../../data/error-handling#retrying-operations).

## Options

The function you provide the `onError` link is passed an object with the following fields:

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

###### `operation`

`Operation`
</td>
<td>

The details of the GraphQL operation that produced an error.

[See type definition](https://github.com/apollographql/apollo-client/blob/main/src/link/core/types.ts#L14-L21)
</td>
</tr>


<tr>
<td>

###### `response`

`ExecutionResult`
</td>
<td>

The (possibly modified) GraphQL result from the server, passed by the next link down the chain (i.e., the link closer to the terminating link).

[See type definition](https://github.com/graphql/graphql-js/blob/main/src/execution/execute.ts#L104-L111)
</td>
</tr>


<tr>
<td>

###### `graphQLErrors`

`ReadonlyArray<GraphQLError>`
</td>
<td>

An array of [GraphQL errors](../../data/error-handling/#graphql-errors) that occurred while executing the operation, if any.

[See type definition](https://github.com/graphql/graphql-js/blob/main/src/error/GraphQLError.ts)

</td>
</tr>


<tr>
<td>

###### `networkError`

`Error | ServerError | ServerParseError`
</td>
<td>

A network error that occurred while attempting to execute the operation, if any.

</td>
</tr>


<tr>
<td>

###### `forward`

`function`
</td>
<td>

A function that calls the next link down the chain. Calling `return forward(operation)` in your `onError` callback [retries the operation](../../data/error-handling#retrying-operations), returning a new observable for the upstream link to subscribe to.

</td>
</tr>

</tbody>
</table>

## Error categorization

An error is passed as a `networkError` if a link further down the chain called the `error` callback on the observable. In most cases, `graphQLErrors` is the `errors` field of the result from the last `next` call.

A `networkError` can contain additional fields, such as a GraphQL object in the case of a failing HTTP status code. In this situation, `graphQLErrors` is an alias for `networkError.result.errors` if the property exists.
