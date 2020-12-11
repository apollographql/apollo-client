---
title: SSR
description: Apollo Client React server side rendering API
---

## Installation

```
npm install @apollo/react-ssr
```

## `getDataFromTree`

The `getDataFromTree` function takes your React tree, determines which queries are needed to render them, and then fetches them all.

### Params

| Param | Type | description |
| - | - | - |
| `tree` | React.ReactNode | The React tree you would like to render and fetch data for. |
| `context` | { [key: string]: any } | Optional values you would like to make available in the React Context during rendering / data retrieval. |

### Result

`getDataFromTree` returns a promise (`Promise<string>`) which resolves when the data is ready in your Apollo Client store. The result is generated using [`ReactDOMServer.renderToStaticMarkup`](https://reactjs.org/docs/react-dom-server.html#rendertostaticmarkup) under the hood.

### Example

See [Executing queries with `getDataFromTree`](../../performance/server-side-rendering/#executing-queries-with-getdatafromtree).

## `renderToStringWithData`

The `renderToStringWithData` function is similar to `getDataFromTree`, but uses [`ReactDOMServer.renderToString`](https://reactjs.org/docs/react-dom-server.html#rendertostring) to render its result instead of [`ReactDOMServer.renderToStaticMarkup`](https://reactjs.org/docs/react-dom-server.html#rendertostaticmarkup) (the React docs help explain the difference).

### Params

| Param | Type | description |
| - | - | - |
| `component` | ReactElement<any> | The React component tree you would like to render and fetch data for. |

### Result

`renderToStringWithData` returns a promise (`Promise<string>`) which resolves when the data is ready in your Apollo Client store. The result is generated using [`ReactDOMServer.renderToString`](https://reactjs.org/docs/react-dom-server.html#rendertostring) under the hood.
