---
title: Hooks migration guide
description: How to integrate the new hooks API into your existing Apollo app
---

The new hooks API for Apollo Client is a simpler way to fetch data in your React app without the boilerplate of render prop components and higher-order components (HOC). We recommend using hooks for all new Apollo code going forward.

## Core packages

React hooks functionality is included in the Apollo Client bundle, whereas the older HOC / render prop component approaches are not. The React team has made it clear that hooks are the future, so we've decided to keep the older approaches available through separate packages.

- [`@apollo/client`](https://www.npmjs.com/package/@apollo/client) - Apollo Client core with React hooks integration
- [`@apollo/react-components`](https://www.npmjs.com/package/@apollo/react-components) - React Apollo render prop components
- [`@apollo/react-hoc`](https://www.npmjs.com/package/@apollo/react-hoc) - React Apollo HOC (`grapqhl`) API

### Installation/upgrade scenarios

**I just want to use Apollo hooks:**

```
npm install @apollo/client
```

(remove the `react-apollo` and `@apollo/react-hooks` packages if they were previously installed)

**I just want to use Apollo render prop components:**

```
npm install @apollo/client @apollo/react-components
```

(remove the `react-apollo` package if it was previously installed)

**I just want to use Apollo HOCs:**

```
npm install @apollo/client @apollo/react-hoc
```

(remove the `react-apollo` package if it was previously installed)

**I want to use all 3 React paradigms in my application:**

```
npm install @apollo/client @apollo/react-components @apollo/react-hoc
```

(remove the `react-apollo` and `@apollo/react-hooks` packages if they were previously installed)

## Server-side rendering

The `getDataFromTree`, `getMarkupFromTree`, and `renderToStringWithData` React SSR functions are bundled with Apollo Client 3. If you want to use these functions, you'll need to import them from `@apollo/client/react/ssr`:

```
import { getDataFromTree } from "@apollo/client/react/ssr";
```

## Testing

React testing utilities are now available through the Apollo Client project, but they aren't included in the default bundle. To access the React testing utilities, you can use the `@apollo/client/testing` bundle like:

```
import { MockedProvider } from '@apollo/client/testing';
```
