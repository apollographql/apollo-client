---
title: Concepts
description: What you need to know to create your own links.
---

## Overview

Apollo Link is designed to be a powerful way to compose actions around data handling with GraphQL. Each link represents a subset of functionality that can be composed with other links to create complex control flows of data.

![Figure 1](../../assets/link/concepts-intro-1.png)

At a basic level, a link is an object with an internal `request` method, that takes an operation and returns an observable. The `request` method can either be implemented directly in an `ApolloLink` subclass, or set directly on an `ApolloLink` instance. In either case, the `request` method implementation is referred to as a `RequestHandler`:

- `RequestHandler`: A function which receives an `Operation` and a `NextLink` and returns an Observable.

An operation is an object with the following information:

- `query`: A `DocumentNode` (parsed GraphQL Operation) describing the operation taking place
- `variables`: A map of variables being sent with the operation
- `operationName`: A string name of the query if it is named, otherwise it is null
- `extensions`: A map to store extensions data to be sent to the server
- `getContext`: A function to return the context of the request. This context can be used by links to determine which actions to perform.
- `setContext`: A function that takes either a new context object, or a function which receives the previous context and returns a new one.
- `toKey`: A function to convert the current operation into a string to be used as a unique identifier

We can chain these links together so that the first link operates on an operation object and each subsequent link operates on the result of the previous link. This allows us to "compose" actions and implement complex data handling logic in an elegant manner. We can visualize them like this:

![Figure 2](../../assets/link/concepts-intro-2.png)

Note that although we have the last link in the above figure (the terminating link) requesting GraphQL results from a server, this doesn't necessarily have to be the case. Your GraphQL results can come from anywhere.

### Requests

At the core of an `ApolloLink` based object is the `request` method, otherwise known as the `RequestHandler`. It takes the following arguments:

- `operation`: The operation being passed through the link.
- `forward`: Specifies the next link in the chain of links (optional).

A link's `request` method is called every time `execute` is run on that link chain, which typically occurs for every operation passed through the link chain. When the `request` method is called, the link "receives" an operation and has to return back data of some kind in the form of an `Observable`. Depending on where the link is in the chain (i.e. whether or not it is at the end of the chain), it will either use the `forward` (the second parameter specifying the next link in the chain), or return back a result on its own. Next links can be used to continue the chain of events until data is fetched from some data source (typically a server).

### Terminating links

Since link chains have to fetch data at some point, they adhere to the concept of terminating and non-terminating links. Simply enough, the terminating link is the one that doesn't use the `forward` argument, but instead turns the operation into the result directly. Typically, this is done with a network request, but there are endless ways of delivering a result. The terminating link is the last link in the composed chain.

### Composition

Links are designed to be composed together to form control flow chains to manage a GraphQL operation request. They can be used as middleware to perform side effects, modify the operation, or even just provide developer tools like logging. They can be afterware which process the result of an operation, handle errors, or even save the data to multiple locations. Links can make network requests including HTTP, WebSockets, and even across the react-native bridge to the native thread for resolution of some kind.

When writing a `RequestHandler`, the second argument is the way to call the next link in the chain. We refer to this argument as `forward` in the docs for a couple of reasons. First, `observers` have a `next` function for sending new results to the subscriber. Second, if you think of composed links like a chain, the request goes `forward` until it gets data (for example from a server request), then it begins to go `back` up the chain to any subscriptions. The `forward` function allows the `RequestHandler` to continue the process to the next link in the chain.

The Apollo Link helper functions exported from the `@apollo/client` package can be used to perform composition of links. These functions are also conveniently located on the `ApolloLink` class itself, and are explained in further detail in the [Composing links](/api/link/concepts/#composing-links) section.

### Context

Since links are meant to be composed, they need an easy way to send metadata about the request down the chain of links. They also need a way for the operation to send specific information to a link no matter where it was added to the chain. To accomplish this, each `Operation` has a `context` object which can be set from the operation while being written and read by each link. The context is read by using `operation.getContext()` and written using `operation.setContext(newContext)` or `operation.setContext((prevContext) => newContext)`. The `context` is *not* sent to the server, but is used for link to link communication.

A quick example:

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

Each context can be set by the operation it was started on. This example sets the `context` when making an Apollo Client `query`:

```js
import { ApolloLink } from '@apollo/client';

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

## Stateless Links

Links are created and shared between every request in your application. However, most links do the same thing for each request and don't need any knowledge about other operations being performed. These links are called stateless links because they have no shared execution state between requests. The alternative way to write links is as [stateful links](/api/link/concepts/#stateful-links).

Stateless links can be written as simple functions wrapped in the `ApolloLink` interface. For example:

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

Stateless links are great for things like middleware and even network requests. For example, adding an auth header to a request is as simple as this:

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

### Extending ApolloLink

Stateless links can also be written by extending the `ApolloLink` class and overwriting the constructor and request method. This is done as an alternative to the closure method shown directly above to pass details to the link. For example, here's the same `reportErrors` link written by extending the `ApolloLink` class:

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

Both of these methods work equally as well for creating links.

## Stateful Links

Links are created and shared between every request in your application. Some links may share state between requests to provide added functionality. The links are called stateful links and are written using the `ApolloLink` API. The alternative way to write links is as  [stateless links](/api/link/concepts/#stateless-links).

Stateful links typically (though are not required to) overwrite the constructor of `ApolloLink` and are required to implement a `request` function with the same signature as a stateless link. For example:

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

This stateful implementation maintains a counter called `operationCount` as an instance variable. Every time a request is passed through the link, we increment `operationCount`. This means that `operationCount` tracks the number of operations that have been handled by the link.

## Composing Links

Links represent small portions of how you want your GraphQL operation to be handled. In order to serve all of the needs of your app, Apollo Link is designed to be composed with other links to build complex actions as needed. Composition is managed in two main ways: additive and directional. Additive composition is how you can combine multiple links into a single chain and directional composition is how you can control which links are used depending on the operation.

It's important to note that no matter how many links you have in your chain, your [terminating link](/api/link/concepts/#terminating-links) has to be last.

### Additive Composition

Apollo Link ships with two ways to compose links. The first is a method called `from` which is both exported as a function and available through the `ApolloLink` class. `from` takes an array of links and combines them all into a single link. For example:

**Using `ApolloLink.from`:**

```js
import { ApolloLink, HttpLink } from '@apollo/client';
import { RetryLink } from 'apollo-link-retry';
import MyAuthLink from '../auth';

const link = ApolloLink.from([
  new RetryLink(),
  new MyAuthLink(),
  new HttpLink({ uri: 'http://localhost:4000/graphql' })
]);
```

**Using `from`:**

```js
import { from, HttpLink } from '@apollo/client';
import { RetryLink } from 'apollo-link-retry';
import MyAuthLink from '../auth';

const link = from([
  new RetryLink(),
  new MyAuthLink(),
  new HttpLink({ uri: 'http://localhost:4000/graphql' })
]);
```

`from` is typically used when you have many links to join together all at once. The alternative way to join links is the `concat` method which joins two links into one.

```js
import { ApolloLink, HttpLink } from '@apollo/client';
import { RetryLink } from 'apollo-link-retry';

const link = ApolloLink.concat(
  new RetryLink(),
  new HttpLink({ uri: 'http://localhost:4000/graphql' })
);
```

### Directional Composition

Given that links are a way of implementing custom control flow for your GraphQL operation, Apollo Link provides an easy way to use different links depending on the operation itself (or any other global state). This is done using the `split` method, which is both exported as a function and available through the `ApolloLink` class.

```js
import { ApolloLink, HttpLink } from '@apollo/client';
import { RetryLink } from 'apollo-link-retry';

const link = new RetryLink().split(
  (operation) => operation.getContext().version === 1,
  new HttpLink({ uri: "http://localhost:4000/v1/graphql" }),
  new HttpLink({ uri: "http://localhost:4000/v2/graphql" })
);
```

`split` takes two required parameters and one optional one. The first argument to split is a function which receives the operation and returns `true` for the first link and `false` for the second link. The second argument is the first link to be split between. The third argument is an optional second link to send the operation to if it doesn't match.

Using `split` allows for per operation based control flow for things like sending mutations to a different server, giving them more retry attempts, using a WebSocket link for subscriptions and an HTTP link for everything else, etc. It can even be used to customize which links are executed for an authenticated user vs a public client.
