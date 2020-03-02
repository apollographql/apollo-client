---
title: Apollo Link overview
description: Customize Apollo Client's data flow
---

> If your application only needs to send conventional HTTP-based requests to a GraphQL server, you probably don't need to use the Apollo Link API. To learn more, see [Basic HTTP networking](../../networking/basic-http-networking/).

The **Apollo Link** library helps you customize the flow of data between Apollo Client and your GraphQL server. You can define your client's network behavior as a list of **link** objects that execute in a sequence:

![Visualization of link interaction](../../assets/link/concepts-intro-2.png)

 In the above diagram:

 1. The first link might log the details of the operation for debugging purposes.
 2. The second link might add an HTTP header to the outgoing operation request.
 3. The third link might then _send_ the request to a GraphQL server over HTTP.

 Note that although the figure above shows the rightmost link requesting results from a remote server, it can execute GraphQL operations against any local or remote target that can respond to them.

By default, Apollo Client uses Apollo Link's `HttpLink` to send GraphQL operations to a remote server over HTTP. Apollo Client takes care of creating this default link, and it covers many use cases without requiring additional customization.

To extend or replace Apollo Client's default networking layer, you can define one or more _custom_ links and specify their order of execution in the `ApolloClient` constructor.

## The anatomy of a link

A link can be either an instance of the `ApolloLink` class or a subclass of it. Regardless, it must define a method named `request` that:

* Accepts an `Operation` object and a `forward` function
* Returns an Observable, usually by calling the `forward` function

This `request` method is known as the link's **request handler**.

Here's an example of a custom link that defines its request handler by passing it as a parameter to the `ApolloLink` constructor:

```js
import { ApolloLink } from '@apollo/client';

const timeStartLink = new ApolloLink((operation, forward) => {
  operation.setContext({ start: new Date() });
  return forward(operation);
});
```

> Apollo Link uses the Observables implementation provided by [`zen-observable`](https://github.com/zenparsing/zen-observable). Refer to the `zen-observable` documentation for additional `Observable` API details.

### The request handler

Every link defines a `request` method, also known as its **request handler**. This method takes the following arguments:

- `operation`: The GraphQL operation that's being passed through the link. For details, see [The `Operation` object](#the-operation-object).
- `forward`: A function for executing the next link in the chain (unless this is a [terminating link](#the-terminating-link)).

Whenever Apollo Client prepares to execute a GraphQL operation, it calls the request handler on the first link in the chain. It's the responsibility of each link to perform its intended operation and then pass execution along to the next link in the chain by calling the [`forward` function](#the-forward-function).

#### The `Operation` object

The `Operation` object includes the following fields:

| Name  | Description  |
|---|---|
| `query`  | A `DocumentNode` (parsed GraphQL operation) that describes the operation taking place.  |
| `variables`  | A map of GraphQL variables being sent with the operation.  |
| `operationName`  | A string name of the query if it is named, otherwise `null`.  |
| `extensions`  |  A map to store extensions data to be sent to the server. |
| `getContext`  | A function to return the context of the request. This context can be used by links to determine which actions to perform. See [Managing context](#managing-context). |
| `setContext`  |  A function that takes either a new context object, or a function which takes in the previous context and returns a new one. See [Managing context](#managing-context). |

#### The `forward` function

When a link's request handler is done executing its logic, it should return a call to the `forward` function that's passed to it (unless it's the chain's [terminating link](#the-terminating-link)). Calling the `forward` function passes execution along to the next link in the chain.

You can use Apollo Link helper functions from the `@apollo/client` package to compose  your links. These functions are members of the `ApolloLink` class itself, and are explained in further detail in [Composing a link chain](#composing-a-link-chain).

## Composing a link chain

Each link should represent a self-contained modification to a GraphQL operation. By composing these links into a chain, you can create an arbitrarily complex model for your client's data flow.

There are two forms of link composition: **additive** and **directional**.

* Additive composition involves combining a set of links into a serially executed chain.
* Directional composition involves branching to one of multiple links, depending on the details of an operation.

Note that no matter how you structure your links, the [terminating link](#the-terminating-link) _must_ be last.

### The terminating link

The **terminating link** is the last link in your composed chain. Instead of calling the `forward` function, it's responsible for sending your composed GraphQL operation to the destination that will execute it (usually a GraphQL server) and returning an `ExecutionResult`.

### Additive composition

If you have a collection of two or more links that should always be executed in the exact same order, you can use the `ApolloLink.from` helper method to combine those links into a _single_ link, like so:

```js
import { from, HttpLink } from '@apollo/client';
import { RetryLink } from '@apollo/link-retry';
import MyAuthLink from '../auth';

const link = from([
  new RetryLink(),
  new MyAuthLink(),
  new HttpLink({ uri: 'http://localhost:4000/graphql' })
]);
```

### Directional composition

You might want your link chain's execution to branch, depending on the details of the operation being performed. You can define this logic with the `split` method of an `ApolloLink` instance. This method takes three parameters:

| Name  | Description  |
|---|---|
| `test`  | A function that takes in the current `Operation` and returns either `true` or `false` depending on its details.  |
| `left`  | The link to execute next if the `test` function returns `true`.  |
| `right`  | An **optional** link to execute next if the `test` function returns `false`. If this is not provided, the link's `forward` parameter is used. |

In the following example, a `RetryLink` passes execution along to one of two different `HttpLink`s depending on the associated context's `version`:

```js
import { ApolloLink, HttpLink } from '@apollo/client';
import { RetryLink } from '@apollo/link-retry';

const link = new RetryLink().split(
  (operation) => operation.getContext().version === 1,
  new HttpLink({ uri: "http://localhost:4000/v1/graphql" }),
  new HttpLink({ uri: "http://localhost:4000/v2/graphql" })
);
```

Other uses for the `split` method include:

* Customizing the number of allowed retry attempts depending on the operation type
* Using different transport methods depending on the operation type (such as HTTP for queries and WebSocket for subscriptions)
* Customizing logic depending on whether a user is logged in


## Link types


### Stateless links

Most links perform the same logic for every operation they process, and they don't need to know anything about operations that have been executed previously. These links are **stateless**.

You can define the request handler for a stateless link in the constructor of an `ApolloLink` object, like so:

```js
import { ApolloLink } from '@apollo/client';

const consoleLink = new ApolloLink((operation, forward) => {
  console.log(`starting request for ${operation.operationName}`);
  return forward(operation).map((data) => {
    console.log(`ending request for ${operation.operationName}`);
    return data;
  })
})
```

Stateless links are great for implementing middleware and even network requests. The following link adds an `Authorization` header to every outgoing request:

```js
import { ApolloLink } from '@apollo/client';

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext(({ headers }) => ({ headers: {
    authorization: Auth.userId(), // however you get your token
    ...headers
  }}));
  return forward(operation);
});
```

This style of link also composes well for customization using a function:

```js
import { ApolloLink } from '@apollo/client';

const reportErrors = (errorCallback) => new ApolloLink((operation, forward) => {
  const observer = forward(operation);
  // errors will be sent to the errorCallback
  observer.subscribe({ error: errorCallback })
  return observer;
});

const link = reportErrors(console.error);
```

#### Extending `ApolloLink`

You can also create a stateless link by extending the `ApolloLink` class and overwriting its constructor and request handler. For example, here's the same `reportErrors` link written as an extension of `ApolloLink`:

```js
import { ApolloLink } from '@apollo/client';

class ReportErrorLink extends ApolloLink {
  constructor(errorCallback) {
    super();
    this.errorCallback = errorCallback;
  }
  request(operation, forward) {
    const observer = forward(operation);
    // errors will be sent to the errorCallback
    observer.subscribe({ error: this.errorCallback })
    return observer;
  }
}

const link = new ReportErrorLink(console.error);
```

### Stateful links

When it's useful, links can maintain state between operations. These links are **stateful**.

Stateful links are usually defined as subclasses of `ApolloLink`. They override the constructor of `ApolloLink` and implement a `request` function with the same signature as a stateless link. For example:

```js
import { ApolloLink } from '@apollo/client';

class OperationCountLink extends ApolloLink {
  constructor() {
    super();
    this.operationCount = 0;
  }
  request(operation, forward) {
    this.operationCount += 1;
    return forward(operation);
  }
}

const link = new OperationCountLink();
```

This stateful link maintains a counter called `operationCount` as an instance variable. Every time a request is passed through the link, `operationCount` is incremented.

## Managing context

As an operation moves down your link chain, it maintains a `context` that each link can read and modify. This allows links to pass metadata down the chain that _other_ links use in their execution logic.

* Obtain the current context object by calling `operation.getContext()`.
* Modify the context object and then write it back with `operation.setContext(newContext)` or `operation.setContext((prevContext) => newContext)`.

Note that this context is *not* included with the operation in the terminating link's request to the GraphQL server or other destination.

Here's an example:

```js
import { ApolloLink } from '@apollo/client';

const timeStartLink = new ApolloLink((operation, forward) => {
  operation.setContext({ start: new Date() });
  return forward(operation);
});

const logTimeLink = new ApolloLink((operation, forward) => {
  return forward(operation).map((data) => {
    // data from a previous link
    const time = new Date() - operation.getContext().start;
    console.log(`operation ${operation.operationName} took ${time} to complete`);
    return data;
  })
});

const link = timeStartLink.concat(logTimeLink)
```

This example defines two links, `timeStartLink` and `logTimeLink`. The `timeStartLink` assigns the current time to the context's `start` field. When the operation completes, the `logTimeLink` then subtracts the value of `start` from the current time to determine the total duration of the operation.

The context's initial value can be set by Apollo Client before the link chain begins its execution. In this example, a call to `client.query` adds a `saveOffline` field to the context, which is then read by the custom link defined at the top:

```js
import { ApolloLink, InMemoryCache } from '@apollo/client';

const link = new ApolloLink((operation, forward) => {
  const { saveOffline } = operation.getContext();
  if (saveOffline) // do offline stuff
  return forward(operation);
})

const client = new ApolloClient({
  cache: new InMemoryCache()
  link,
});

// send context to the link
const query = client.query({ query: MY_GRAPHQL_QUERY, context: { saveOffline: true }});
```
