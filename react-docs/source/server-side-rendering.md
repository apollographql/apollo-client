---
title: Server Side Rendering
order: 16
---

XXX: just copied over from old docs, need to straighten out, and include http://docs.apollostack.com/apollo-client/index.html#store-rehydration

The `react-apollo` library supports integrated server side rendering for both store rehydration purposes, or fully rendered markup. No changes are required to client queries to support this, however, queries can be ignored during server rendering by passing `ssr: false` in the query options. For example:

```js
const withClientOnlyUser = graphql(GET_USER_WITH_ID, {
  options: () => ({ ssr: false }) // won't be called during SSR
});

const MyComponentWithData = withClientOnlyUser(MyComponent);
```


<h3 id="getDataFromTree">Using `getDataFromTree`</h3>

The `getDataFromTree` function takes your React tree and returns the context of you React tree. This can be used to get the initialState via `context.store.getState()`

```js
// server application code (custom usage)
import { getDataFromTree } from "react-apollo/server"

// during request
getDataFromTree(app).then((context) => {
  // markup with data from requests
  const markup = ReactDOM.renderToString(app);

  // now send the markup to the client alongside context.store.getState()
});
```

<h3 id="renderToStringWithData">Using `renderToStringWithData`</h3>

The `renderToStringWithData` function takes your react tree and returns the stringified tree with all data requirements. It also injects a script tag that includes `window. __APOLLO_STATE__ ` which equals the full redux store for hydration. This method returns a promise that eventually returns the markup

```js
// server application code (integrated usage)
import { renderToStringWithData } from "react-apollo/server"

// during request
renderToStringWithData(app).then(markup => {
  // send markup to client
});
```

> Server notes:
  When creating the client on the server, it is best to use `ssrMode: true`. This prevents unneeded force refetching in the tree walking.

> Client notes:
  When creating new client, you can pass `initialState: __APOLLO_STATE__ ` to rehydrate which will stop the client from trying to requery data.
