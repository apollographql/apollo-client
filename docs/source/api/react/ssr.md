---
title: SSR
description: Apollo Client React server side rendering API
---

## Installation

Apollo Client >= 3 includes React hooks functionality out of the box. You don't need to install any additional packages.

## `getDataFromTree`

The `getDataFromTree` function takes your React tree, determines which queries are needed to render them, and then fetches them all.

```js
import { getDataFromTree } from "@apollo/client/react/ssr";
```

### Params

| Param | Type | description |
| - | - | - |
| `tree` | React.ReactNode | The React tree you would like to render and fetch data for. |
| `context` | { [key: string]: any } | Optional values you would like to make available in the React Context during rendering / data retrieval. |

### Result

`getDataFromTree` returns a promise (`Promise<string>`) which resolves when the data is ready in your Apollo Client store. The result is generated using [`ReactDOMServer.renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup) under the hood.

### Example

See [Executing queries with `getDataFromTree`](../../performance/server-side-rendering/#executing-queries-with-getdatafromtree).

## `renderToStringWithData`

The `renderToStringWithData` function is similar to `getDataFromTree`, but uses [`ReactDOMServer.renderToString`](https://react.dev/reference/react-dom/server/renderToString) to render its result instead of [`ReactDOMServer.renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup) (the React docs help explain the difference).

```js
import { renderToStringWithData } from "@apollo/client/react/ssr";
```

### Params

| Param | Type | description |
| - | - | - |
| `component` | ReactElement<any> | The React component tree you would like to render and fetch data for. |

### Result

`renderToStringWithData` returns a promise (`Promise<string>`) which resolves when the data is ready in your Apollo Client store. The result is generated using [`ReactDOMServer.renderToString`](https://react.dev/reference/react-dom/server/renderToString) under the hood.
