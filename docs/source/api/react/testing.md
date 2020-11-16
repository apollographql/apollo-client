---
title: Testing
description: Apollo Client React testing API
---

## Installation

Apollo Client >= 3 includes React testing utilities out of the box. You don't need to install any additional packages.

## `MockedProvider`

```js
import { MockedProvider } from "@apollo/client/testing";
```

The `MockedProvider` is a test-utility that allows you to create a mocked version of the [`ApolloProvider`](./hooks/#the-apolloprovider-component) that doesn't send out network requests to your API, but rather allows you to specify the exact response payload for a given request.

The `<MockedProvider />` component takes the following props:

| Prop | Type | Description |
| - | - | - |
| mocks? | ReadonlyArray<MockedResponse> | An array containing a request object and the corresponding response. |
| addTypename? | boolean | A boolean indicating whether or not `__typename` are injected into the documents sent to graphql. This **defaults to true**. |
| defaultOptions? | DefaultOptions | An object containing options to pass directly to the `ApolloClient` instance. |
| cache? | ApolloCache<TSerializedCache> | A custom cache object to be used in your test. Defaults to `InMemoryCache`. Useful when you need to define a custom `dataIdFromObject` function for automatic cache updates. |
| resolvers? | Resolvers | Apollo Client local resolvers |
| childProps? | object | Props that should be passed down to the child |

Here is an example `mocks` prop shape:

```js
const mocks = [
  {
    request: {
      query: SOME_QUERY,
      variables: { first: 4 }
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
      query: SOME_QUERY,
      variables: { first: 8}
    },
    error: new Error("Something went wrong")
  }
]
```

The above shows that if the request `SOME_QUERY` is fired with variables `{ first: 4 }` that it results in the data in the `result` object.

If `SOME_QUERY` is fired with variables `{ first: 8 }` then it results in an `error`.

### Example

```js
it("runs the mocked query", () => {
  render(
    <MockedProvider mocks={mocks}>
      <MyQueryComponent />
    </MockedProvider>
  )

  // Run assertions on <MyQueryComponent/>
});
```
