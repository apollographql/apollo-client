---
title: Server-side rendering
---


Apollo provides two techniques to allow your applications to load quickly, avoiding unnecessary delays to users:

 - Store rehydration, which allows your initial set of queries to return data immediately without a server roundtrip.
 - Server side rendering, which renders the initial HTML view on the server before sending it to the client.

You can use one or both of these techniques to provide a better user experience.

## Store rehydration

For applications that can perform some queries on the server prior to rendering the UI on the client, Apollo allows for setting the initial state of data. This is sometimes called rehydration, since the data is "dehydrated" when it is serialized and included in the initial HTML payload.

For example, a typical approach is to include a script tag that looks something like:

```html
<script>
  window.__APOLLO_STATE__ = JSON.stringify(client.extract());
</script>
```

You can then rehydrate the client using the initial state passed from the server:

```js
const client = new ApolloClient({
  cache: new InMemoryCache().restore(window.__APOLLO_STATE__),
  link,
});
```

We'll see below how you can generate both the HTML and the Apollo store's state using Node and `react-apollo`'s server rendering functions. However if you are rendering HTML via some other means, you will have to generate the state manually.

Then, when the client runs the first set of queries, the data will be returned instantly because it is already in the store!

If you are using `fetchPolicy: network-only` or `fetchPolicy: cache-and-network` on some of the initial queries, you can pass the `ssrForceFetchDelay` option to skip force fetching during initialization, so that even those queries run using the cache:

```js
const client = new ApolloClient({
  cache: new InMemoryCache().restore(window.__APOLLO_STATE__),
  link,
  ssrForceFetchDelay: 100,
});
```

## Server-side rendering

You can render your entire React-based Apollo application on a Node server using rendering functions built into `react-apollo`. These functions take care of the job of fetching all queries that are required to rendering your component tree. Typically you would use these functions from within a HTTP server such as [Express](https://expressjs.com).

No changes are required to client queries to support this, so your Apollo-based React UI should support SSR out of the box.

### Server initialization

In order to render your application on the server, you need to handle a HTTP request (using a server like Express, and a server-capable Router like React-Router), and then render your application to a string to pass back on the response.

We'll see how to take your component tree and turn it into a string in the next section, but you'll need to be a little careful in how you construct your Apollo Client instance on the server to ensure everything works there as well:

1. When [creating an Apollo Client instance](/essentials/get-started/) on the server, you'll need to set up your network interface to connect to the API server correctly. This might look different to how you do it on the client, since you'll probably have to use an absolute URL to the server if you were using a relative URL on the client.
2. Since you only want to fetch each query result once, pass the `ssrMode: true` option to the Apollo Client constructor to avoid repeated force-fetching.
3. You need to ensure that you create a new client or store instance for each request, rather than re-using the same client for multiple requests. Otherwise the UI will be getting stale data and you'll have problems with [authentication](/recipes/authentication/).

Once you put that all together, you'll end up with initialization code that looks like this:

```jsx
// This example uses React Router v4, although it should work
// equally well with other routers that support SSR

import { ApolloProvider } from 'react-apollo';
import { ApolloClient } from 'apollo-client';
import { createHttpLink } from 'apollo-link-http';
import Express from 'express';
import { StaticRouter } from 'react-router';
import { InMemoryCache } from "apollo-cache-inmemory";

import Layout from './routes/Layout';

// Note you don't have to use any particular http server, but
// we're using Express in this example
const app = new Express();
app.use((req, res) => {

  const client = new ApolloClient({
    ssrMode: true,
    // Remember that this is the interface the SSR server will use to connect to the
    // API server, so we need to ensure it isn't firewalled, etc
    link: createHttpLink({
      uri: 'http://localhost:3010',
      credentials: 'same-origin',
      headers: {
        cookie: req.header('Cookie'),
      },
    }),
    cache: new InMemoryCache(),
  });

  const context = {};

  // The client-side App will instead use <BrowserRouter>
  const App = (
    <ApolloProvider client={client}>
      <StaticRouter location={req.url} context={context}>
        <Layout />
      </StaticRouter>
    </ApolloProvider>
  );

  // rendering code (see below)
});

app.listen(basePort, () => console.log( // eslint-disable-line no-console
  `app Server is now running on http://localhost:${basePort}`
));
```

```jsx
// ./routes/Layout.js
import { Route, Switch } from 'react-router';
import { Link } from 'react-router-dom';
import React from 'react';

// A Routes file is a good shared entry-point between client and server
import routes from './routes';

const Layout = () =>
  <div>
    <nav>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/another">Another page</Link>
        </li>
      </ul>
    </nav>

    {/* New <Switch> behavior introduced in React Router v4
       https://reacttraining.com/react-router/web/api/Switch */}
    <Switch>
      {routes.map(route => <Route key={route.name} {...route} />)}
    </Switch>
  </div>;

export default Layout;
```

```js
// ./routes/index.js
import MainPage from './MainPage';
import AnotherPage from './AnotherPage';

const routes = [
  {
    path: '/',
    name: 'home',
    exact: true,
    component: MainPage,
  },
  {
    path: '/another',
    name: 'another',
    component: AnotherPage,
  },
];

export default routes;
```

You can check out the [GitHunt app's `src/server.js`](https://github.com/apollographql/GitHunt-React/blob/master/src/server.js) for a complete working example.

Next we'll see what that rendering code actually does.

### Using `getDataFromTree`

The `getDataFromTree` function takes your React tree, determines which queries are needed to render them, and then fetches them all. It does this recursively down the whole tree if you have nested queries. It returns a promise which resolves when the data is ready in your Apollo Client store.

At the point that the promise resolves, your Apollo Client store will be completely initialized, which should mean your app will now render instantly (since all queries are prefetched) and you can return the stringified results in the response:

```js
import { getDataFromTree } from "react-apollo"

const client = new ApolloClient(....);

// during request (see above)
getDataFromTree(App).then(() => {
  // We are ready to render for real
  const content = ReactDOM.renderToString(App);
  const initialState = client.extract();

  const html = <Html content={content} state={initialState} />;

  res.status(200);
  res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(html)}`);
  res.end();
});
```

Your markup in this case can look something like:

```jsx
function Html({ content, state }) {
  return (
    <html>
      <body>
        <div id="root" dangerouslySetInnerHTML={{ __html: content }} />
        <script dangerouslySetInnerHTML={{
          __html: `window.__APOLLO_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};`,
        }} />
      </body>
    </html>
  );
}
```

### Avoiding the network for local queries

If your GraphQL endpoint is on the same server that you're rendering from, you may want to avoid using the network when making your SSR queries. In particular, if localhost is firewalled on your production environment (eg. Heroku), making network requests for these queries will not work.

One solution to this problem is to use an Apollo Link to fetch data using a local graphql schema instead of making a network request. To achieve this, when creating an Apollo Client on the server, you could use [SchemaLink](https://www.apollographql.com/docs/link/links/schema) instead of using `createHttpLink` that uses your schema and context to run the query immediately, without any additional network requests.

```js
import { ApolloClient } from 'apollo-client'
import { SchemaLink } from 'apollo-link-schema';

// ...

const client = new ApolloClient({
  ssrMode: true,
  // Instead of "createHttpLink" use SchemaLink here
  link: new SchemaLink({ schema }),
  cache: new InMemoryCache(),
});
```

### Skipping queries for SSR

If you want to intentionally skip a query during SSR, you can pass `ssr: false` in the query options. Typically, this will mean the component will get rendered in its loading state on the server. For example:

```jsx
const withClientOnlyUser = () => (
  <Query query={GET_USER_WITH_ID} ssr={false}>
    {({ data }) => <span>I won't be run on the server</span>}
  </Query>
);

```

### Using `renderToStringWithData`

The `renderToStringWithData` function simplifies the above and simply returns the content string  that you need to render. So it reduces the number of steps slightly:

```js
// server application code (integrated usage)
import { renderToStringWithData } from "react-apollo"

const client = new ApolloClient(...);

// during request
renderToStringWithData(App).then((content) => {
  const initialState = client.extract();
  const html = <Html content={content} state={initialState} />;

  res.status(200);
  res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(html)}`);
  res.end();
});
```
