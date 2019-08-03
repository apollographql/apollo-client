---
title: React Common
description: React Apollo Common API reference
---

## Package

Npm: [`@apollo/react-common`](https://www.npmjs.com/package/@apollo/react-common)

## `ApolloProvider`

The `ApolloProvider` component leverages [React's Context API](https://reactjs.org/docs/context.html) to make a configured Apollo Client instance available throughout a React component tree. This component can be imported directly from the `@apollo/react-common` package where it lives, or from one of the `@apollo/react-hooks`, `@apollo/react-components`, and `@apollo/react-hoc` packages.

```js
import { ApolloProvider } from "@apollo/react-common";
// or
import { ApolloProvider } from "@apollo/react-hooks";
// etc...
```

### Props

| Option | Type | Description |
| - | - | - |
| `client` | ApolloClient&lt;TCache&gt; | An `ApolloClient` instance. |

### Example

```jsx
ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  document.getElementById("root"),
);
```

## `ApolloConsumer`

One way to access the configured Apollo Client instance directly is to create an `ApolloConsumer` component and provide a render prop function as its child. The render prop function will be called with your `ApolloClient` instance as its only argument. You can think of the `ApolloConsumer` component as similar to the `Consumer` component from the [React Context API](https://reactjs.org/docs/context.html).

### Example

```jsx
import React from 'react';
import { ApolloConsumer } from "@apollo/react-common";
// or from the hooks, components, hoc packages:
// import { ApolloConsumer } from "@apollo/react-hooks";

const WithApolloClient = () => (
  <ApolloConsumer>
    {client => "We have access to the client!" /* do stuff here */}
  </ApolloConsumer>
);
```
