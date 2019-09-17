---
title: Hooks migration guide
description: How to integrate the new hooks API into your existing Apollo app
---

The new hooks API for Apollo Client is a simpler way to fetch data in your React app without the boilerplate of render prop components and higher-order components (HOC). We recommend using hooks for all new Apollo code going forward.

Upgrading to the new hooks API requires a major version bump from the previous version of Apollo's React integration. Before updating to the latest version, it's important to review the following details:

## Breaking changes

Please keep in mind that this is a major version release, and there are some breaking changes (we've tried to keep them to a minimum). The full breaking changes list can be found in the [`Changelog.md`](https://github.com/apollographql/react-apollo/blob/master/Changelog.md#breaking-changes).

## New packages

To help reduce application bundle sizes, React Apollo 3 introduces a new modular package structure:

**Individual packages (recommended):**

- [@apollo/react-hooks](https://www.npmjs.com/package/@apollo/react-hooks)
- [@apollo/react-components](https://www.npmjs.com/package/@apollo/react-components)
- [@apollo/react-hoc](https://www.npmjs.com/package/@apollo/react-hoc)

**Umbrella package (includes hooks, render props, and HOCs):**

- [react-apollo](https://www.npmjs.com/package/react-apollo)

**Supporting packages:**

- [@apollo/react-common](https://www.npmjs.com/package/@apollo/react-common)
- [@apollo/react-ssr](https://www.npmjs.com/package/@apollo/react-ssr)
- [@apollo/react-testing](https://www.npmjs.com/package/@apollo/react-testing)

You can use the umbrella `react-apollo` package to get access to the new hooks, along with the legacy `graphql` HOC and `Query` / `Mutation` / `Subscription` components. If you're planning on supporting each of these 3 different paradigms in your application while you incrementally migrate, then the `react-apollo` package should work well.

If you're only planning on using some of this functionality, like only the new hooks, then you'll want to install the individual packages instead of `react-apollo`. Installing only the `@apollo/react-hooks` package yields a 50% bundle size savings than using all of `react-apollo`.

### Installation/upgrade scenarios

**I just want to use Apollo hooks:**

```
npm install @apollo/react-hooks
```

**I just want to use Apollo render prop components:**

```
npm install @apollo/react-components
```

(and remove the `react-apollo` package if it was previously installed)

**I just want to use Apollo HOCs:**

```
npm install @apollo/react-hoc
```

(and remove the `react-apollo` package if it was previously installed)

**I want to use all 3 React Apollo paradigms in my application:**

```
npm install react-apollo
```

> **Note:** We're going to be moving away from the `react-apollo` package in the future, so installing the individual paradigm packages instead of `react-apollo` is recommended.

### Bundle size note

React Apollo 3 uses hooks behind the scenes for everything, including the `graphql` HOC and render prop components. While installing and using only the paradigm package(s) that interest you will save on bundle size, the savings will vary based on the packages you're using. This is because the HOC package depends on the components package, and the components package depends on the hooks package. In other words:

```
@apollo/react-hoc <-- @apollo/react-components <-- @apollo/react-hooks
@apollo/react-components <-- @apollo/react-hooks
@apollo/react-hooks
```

This means using only the `@apollo/react-hooks` package will give you the greatest bundle size savings.

## Server-side rendering

The `getDataFromTree` and `renderToStringWithData` SSR functions are no longer bundled with any of the React Apollo packages in order to help reduce bundle sizes for those who aren't using SSR. If you want to use these functions, you'll need to add in the `@apollo/react-ssr` package:

```
npm install @apollo/react-ssr
```

## Testing

Testing utilities are no longer bundled with any of the React Apollo packages. Everything has been moved into the `@apollo/react-testing` package:

```
npm install --save-dev @apollo/react-testing
```
