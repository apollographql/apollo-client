---
title: Testing
description: Apollo Client React testing API
api_reference: true
---

> For more guidance on running tests with `MockedProvider`, see [Testing React components](../../development-testing/testing/).

## `MockedProvider`



```js
import { MockedProvider } from "@apollo/client/testing";
```

The `MockedProvider` component is a mocked version of [`ApolloProvider`](./hooks/#the-apolloprovider-component) that doesn't send network requests to your API. Instead, you to specify the exact response payload for a given GraphQL operation. This enables you to test your application's operations without communicating with a server.

#### Props

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

###### `mocks`

`ReadonlyArray<MockedResponse>`
</td>
<td>

An array containing GraphQL operation definitions and their corresponding mocked responses. See [Defining mocked responses](../../development-testing/testing/#defining-mocked-responses).
</td>
</tr>


<tr>
<td>

###### `addTypename`

`Boolean`
</td>
<td>

If `true`, the `MockedProvider` automatically adds the `__typename` field to every object type included in every executed query. Set this to `false` if the responses in your `mocks` array do _not_ include `__typename` fields. See [Setting `addTypename`](../../development-testing/testing/#setting-addtypename).

The default value is `true`.

</td>
</tr>


<tr>
<td>

###### `defaultOptions`

`DefaultOptions`
</td>
<td>

An object containing options to pass directly to the `MockedProvider`'s `ApolloClient` instance. See [Example `defaultOptions` object](../core/ApolloClient/#example-defaultoptions-object).

</td>
</tr>


<tr>
<td>

###### `cache`

`ApolloCache<TSerializedCache>`
</td>
<td>

A custom cache for the `MockedProvider`'s `ApolloClient` instance to use. Useful when you need to define a custom `dataIdFromObject` function for automatic cache updates.

By default, `MockedProvider` creates an `InMemoryCache` with default configuration.

</td>
</tr>


<tr>
<td>

###### `resolvers`

`Resolvers`
</td>
<td>

**Deprecated.** A collection of [local resolvers](../../local-state/local-resolvers/) for the `MockedProvider`'s `ApolloClient` instance to use.

</td>
</tr>


<tr>
<td>

###### `childProps`

`object`
</td>
<td>

Props to pass down to the `MockedProvider`'s child.

</td>
</tr>

</tbody>
</table>

#### Example `mocks` array

```js
const mocks = [
  {
    request: {
      query: GET_DOG,
      variables: { index: 4 }
    },
    result: {
      data: {
        dog: {
          name: "Douglas"
        }
      }
    }
  },
  {
    request: {
      query: GET_DOG,
      variables: { index: 8 }
    },
    error: new Error("Something went wrong")
  }
]
```

With the `mocks` array above:

* If the `GET_DOG` operation is executed with variables `{ index: 4 }`, it returns a dog named `Douglas`.
* If `GET_DOG` is executed with variables `{ index: 8 }`, it returns an `error`.

#### Usage

See [Testing React components](../../development-testing/testing/).
