---
title: Server
---

`react-apollo` provides some utilities to aid in server side rendering and store hydration. To learn how to server side render in your app be sure to read the [recipe for server side rendering](server-side-rendering.html). The following is simply a reference for the APIs of the methods used in server side rendering and not a tutorial teaching you how to set it up.

<h2 id="getDataFromTree" title="getDataFromTree">`getDataFromTree(jsx)`</h2>

```js
import { getDataFromTree } from 'react-apollo';
```

This function will walk through your React tree to find any components enhanced with `graphql()`. It will take those components which are queries, execute the queries, and return a promise to notify you when all of the queries have been resolved. This promise resolves to no value. You will not be able to see the data returned by the queries that were found.

After executing `getDataFromTree` when you render with the [`react-dom/server` methods][] like `renderToString` or `renderToStaticMarkup` the Apollo cache will be primed and your components will render with the fetched data in your cache. You may also choose to use the `react-apollo` [`renderToStringWithData()`](#renderToStringWithData) method which will call this function and then follow that with a call to [`react-dom/server`’s `renderToString`][].

If one of the queries fails the promise won’t reject until all of the queries have either resolved or rejected. At that point we will reject the promise returned from `getDataFromTree` with an error that has the property `error.queryErrors` which is an array of all the errors from the queries we executed. At that point you may decide to either render your tree anyway (if so, errored components will be in a loading state), or render an error page and do a full re-render on the client.

For more information see the [recipe for server side rendering](#server-side-rendering.html).

[`react-dom/server` methods]: https://facebook.github.io/react/docs/react-dom-server.html
[`react-dom/server`’s `renderToString`]: https://facebook.github.io/react/docs/react-dom-server.html#rendertostring

**Example:**

```js
const jsx = (
  <ApolloProvider client={client}>
    <MyRootComponent/>
  </ApolloProvider>
);

getDataFromTree(jsx)
  .then(() => {
    console.log(renderToString(jsx));
  })
  .catch((error) => {
    console.error(error);
  });
```

<h2 id="renderToStringWithData" title="renderToStringWithData">
  `renderToStringWithData(jsx)`
</h2>

```js
import { renderToStringWithData } from 'react-apollo';
```

This function calls [`getDataFromTree()`](#getDataFromTree) and when the promise returned by that function resolves it calls [`react-dom/server`’s `renderToString`][].

For more information see the documentation for [`getDataFromTree()`](#getDataFromTree) or the [recipe for server side rendering](#server-side-rendering.html).

[`react-dom/server`’s `renderToString`]: https://facebook.github.io/react/docs/react-dom-server.html#rendertostring

**Example:**

```js
renderToStringWithData(
  <ApolloProvider client={client}>
    <MyRootComponent/>
  </ApolloProvider>
)
  .then((html) => {
    console.log(html);
  })
  .catch((error) => {
    console.error(error);
  });
```
