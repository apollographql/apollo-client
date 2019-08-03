---
title: React Apollo 3 Migration Guide
description: Getting up and running with React Apollo 3
---

Before updating to React Apollo 3, it's import to review the following details.

## Breaking changes

Please keep in mind that this is a major version release, and there are some breaking changes (we've tried to keep them to a minimum). The full breaking changes list can be found in the [`Changelog.md`](https://github.com/apollographql/react-apollo/blob/master/Changelog.md#breaking-changes).

## New packages

To help reduce application bundle sizes, React Apollo 3 introduces a new package structure:

**Everything package**

- [react-apollo](https://www.npmjs.com/package/react-apollo)

**Individual React paradigm packages**

- [@apollo/react-hooks](https://www.npmjs.com/package/@apollo/react-hooks)
- [@apollo/react-components](https://www.npmjs.com/package/@apollo/react-components)
- [@apollo/react-hoc](https://www.npmjs.com/package/@apollo/react-hoc)

**Support packages**

- [@apollo/react-common](https://www.npmjs.com/package/@apollo/react-common)
- [@apollo/react-ssr](https://www.npmjs.com/package/@apollo/react-ssr)
- [@apollo/react-testing](https://www.npmjs.com/package/@apollo/react-testing)

You can use the umbrella `react-apollo` package to get access to the `graphql` HOC, `Query` / `Mutation` / `Subscription` render prop components, and the new Hooks. If you're using or are planning on using each of these 3 different paradigms in your application, then the `react-apollo` package should work well. If you're only planning on using some of this functionality however, like just the new Hooks, then you'll want to install the individual paradigm package instead of `react-apollo` (to help reduce your application's overall bundle size).

### Installation/upgrade scenarios

**I just want to use React Apollo Hooks:**

```
npm install @apollo/react-hooks
```

**I just want to use React Apollo render prop components:**

```
npm install @apollo/react-components
```

(and remove the `react-apollo` package if it was previously installed)

**I just want to use React Apollo HOC's:**

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

React Apollo 3 uses Hooks behind the scenes for everything, including the `graphql` HOC and render prop components. While installing and using only the paradigm package(s) that interest you will save on bundle size, the savings will vary based on the packages you're using. This is because the HOC package depends on the Components package, and the Components package depends on the Hooks package. In other words:

```
@apollo/react-hoc <-- @apollo/react-components <-- @apollo/react-hooks
@apollo/react-components <-- @apollo/react-hooks
@apollo/react-hooks
```

This means using only the `@apollo/react-hooks` package will give you the greatest bundle size savings.

## Server-side rendering

The `getDataFromTree` and `renderToStringWithData` SSR functions are no longer bundled with any of the React Apollo packages (to help reduce bundle sizes for those who aren't using SSR). If you want to use these functions, you'll need to add in the `@apollo/react-ssr` package:

```
npm install @apollo/react-ssr
```

## Testing

Testing utilities are no longer bundled with any of the React Apollo packages. Everything has been moved into the `@apollo/react-testing` package:

```
npm install --save-dev @apollo/react-testing
```
