---
title: Server Side Rendering
order: 26
---


Apollo provides two techniques to allow your applications to load quickly, avoiding unnecessary delays to users:

 - Store rehydration, which allows your initial set of queries to return data immediately without a server roundtrip.
 - Server side rendering, which renders the initial HTML view on the server before sending it to the client.

You can use one or both of these techniques to provide a better user experience.

<h2 id="store-rehydration">Store rehydration</h2>

For applications that can perform some queries on the server prior to rendering the UI on the client, Apollo allows for setting the initial state of data. This is sometimes called rehydration (the data is "dehydrated" when it is serialized and included in the initial HTML payload).

For example, a typical approach is to include a script tag that looks something like:

```html
<script>
  // The contents of { ... } could be the result of client.store.getState(),
  // or synthetically generated to look similar
  window.__APOLLO_STATE__ = { ... };
</script>
```

You can then rehydrate the client using the initial state passed from the server:
```js
const client = new ApolloClient({
  initialState: window.__APOLLO_STATE__,
});
```

> We'll see below how you can generate both the HTML and the Apollo store's state using Node and `react-apollo`'s server rendering functions. However if you are rendering HTML via some other means, you will have to generate the state manually.

> Note: if you are using [Redux](redux.html) externally to Apollo, and already have store rehydration, you should pass the store state into the [`Store` constructor](http://redux.js.org/docs/basics/Store.html).

Then, when the client runs the first set of queries, the data will be returned instantly because it is already in the store!

> Note that if you are using [`forceFetch`](cache-updates.html#forceFetch) on queries, you should pass the `ssrForceFetchDelay` option to skip force fetching during initialization:

```js
const client = new ApolloClient({
  initialState: window.__APOLLO_STATE__,
  ssrForceFetchDelay: 100,
});
```

<h2 id="server-rendering">Server-side rendering and hydration</h2>

You can render your entire React-based Apollo application on a Node server using some built in rendering functions. These functions take care of the job of fetching all queries that are required to rendering your component tree. Typically you would use these functions from within a HTTP server such as [Express](https://expressjs.com).

No changes are required to client queries to support this, however, queries can be ignored during server rendering by passing `ssr: false` in the query options. Typically, this will mean the component will get rendered in it's loading state on the server. For example:

```js
const withClientOnlyUser = graphql(GET_USER_WITH_ID, {
  options: { ssr: false }, // won't be called during SSR
});
```

<h3 id="server-initialization">Server Initialization</h3>

In order to render your application on the server, you need to handle a HTTP request (using a server like Express, and a server-capable Router like React-Router), and then render your application to a string to pass back on the response.

We'll see how to take your component tree and turn it into a string in the next section, but you'll need to be a little careful in how you construct your Apollo Client instance on the server to ensure everything works there as well:

1. When [creating an Apollo Client instance](initialization.html) on the server, you'll need to set up you network interface to connect to the API server correctly (this will look different to how you do it on the client).

2. As you just want to fetch query results once, pass the `ssrMode: true` option to the Apollo Client constructor to avoid force-fetching.

3. You need to ensure that you create a new client for each request, rather than re-using the same client for multiple requests as otherwise you'll have problems with [authentication](auth.html) and you may see stale results.

Once you put that all together, you'll end up with initialization code that looks as follows:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';
import Express from 'express';
import { match, RouterContext } from 'react-router';

// A Routes file is a good shared entry-point betwen client and server
import routes from './routes';

// Note you don't have to use any particular http server
const app = new Express();
app.use((req, res) => {

  // This example uses React Router, although it should work equally well with other
  // routers that support SSR
  match({ routes, location: req.originalUrl }, (error, redirectLocation, renderProps) => {

    const client = new ApolloClient({
      ssrMode: true,
      // Remember that this is the interface the SSR server will use to connect to the
      // API server, so we need to ensure it isn't firewalled, etc
      networkInterface: createNetworkInterface('http://localhost:3010', {
        credentials: 'same-origin',
        // transfer request headers to networkInterface so that they're accessible to proxy server
        // Addresses this issue: https://github.com/matthew-andrews/isomorphic-fetch/issues/83
        headers: req.headers,
      }),
    });

    const app = (
      <ApolloProvider client={client}>
        <RouterContext {...renderProps} />
      </ApolloProvider>
    );

    // rendering code (see below)
  });
});

app.listen(basePort, () => console.log( // eslint-disable-line no-console
  `App Server is now running on http://localhost:${basePort}`
));
```
You can check out the [GitHunt app's `ui/server.js`](https://github.com/apollostack/GitHunt-React/blob/master/ui/server.js) for a complete working example.


Next we'll see what that rendering code actually does.

<h3 id="getDataFromTree">Using `getDataFromTree`</h3>

The `getDataFromTree` function takes your React tree, determines which queries are needed to render them, and then fetches them all (it does this recursively if you have nested queries). It returns a promise which returns the React Context provided by `ApolloProvider` (you can use this to get the current store state with `context.store.getState()`).

At the point that the promise returns, your Apollo Client will be completely initialized, which should mean your app will now render instantly (all queries are prefetched) and you can return the stringified results to the request:

```js
import { getDataFromTree } from "react-apollo/server"

// during request (see above)
getDataFromTree(app).then((context) => {
  // We are ready to render for real
  const content = ReactDOM.renderToString(app);

  const html = <Html content={content} state={context.store.getState()} />;

  res.status(200);
  res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(html)}`);
  res.end();
});
```

Your markup in this case can look something like:

```js
function Html({ content, state }) {
  return (
    <html>
      <body>
        <div id="content" dangerouslySetInnerHTML={{ __html: content }} />
        <script dangerouslySetInnerHTML={{
          __html: `window.__APOLLO_STATE__=${JSON.stringify(state)};`,
        }} />
      </body>
    </html>
  );
}
```

<!--  Leave this bit out until it's fixed -->
<!-- <h3 id="renderToStringWithData">Using `renderToStringWithData`</h3>

The `renderToStringWithData` function takes your react tree and returns the stringified tree with all data requirements. It also injects a script tag that includes `window. __APOLLO_STATE__ ` which equals the full redux store for hydration. This method returns a promise that eventually returns the markup

```js
// server application code (integrated usage)
import { renderToStringWithData } from "react-apollo/server"

// during request
renderToStringWithData(app).then(markup => {
  // send markup to client
});
```

> See the notes above about `getDataFromTree`.

> Extra Client notes:
  - In this case, pass `initialState: JSON.parse(decodeURI(__APOLLO_STATE__))`
  - As of this writing, this technique will lead to a React warning "Target node has markup rendered by React, but there are unrelated nodes as well"---we're working on a better solution to this, but in the meantime if you want to avoid the error, use `getDataFromTree` directly.  <h2 id="store-rehydration">Store hydration</h2> -->
