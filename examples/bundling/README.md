# Apollo Client Bundling Examples

This project contains example applications that show how Apollo Client can be bundled and prepared for production use, with the help of modern build tools like [Rollup](https://rollupjs.org) and [webpack](https://webpack.js.org). This includes leveraging tree-shaking / dead code elimination features to remove the parts of the Apollo Client codebase that aren't being used, to help reduce the final production bundle size.

## Applications

- [no-tree-shaking/rollup-ac2](./no-tree-shaking/rollup-ac2) - An Apollo Client 2 based example application that uses React for its view layer, and Rollup without tree shaking, to build its production bundle.

- [no-tree-shaking/rollup-ac3](./no-tree-shaking/rollup-ac3) - An Apollo Client 3 based example application that uses React for its view layer, and Rollup without tree shaking, to build its production bundle.

- [no-tree-shaking/rollup-ac3-no-react](./no-tree-shaking/rollup-ac3-no-react) - An Apollo Client 3 based example application that doesn't have a view layer, and uses Rollup without tree shaking to build its production bundle.

- [tree-shaking/rollup-ac2](./tree-shaking/rollup-ac2) - An Apollo Client 2 based example application that uses React for its view layer, and Rollup with tree shaking, to build its production bundle.

- [tree-shaking/rollup-ac3](./tree-shaking/rollup-ac3) - An Apollo Client 3 based example application that uses React for its view layer, and Rollup with tree shaking, to build its production bundle.

- [tree-shaking/rollup-ac3-no-react](./tree-shaking/rollup-ac3-no-react) - An Apollo Client 3 based example application that doesn't have a view layer, and uses Rollup with tree shaking to build its production bundle.

- [tree-shaking/webpack-ac3](./tree-shaking/webpack-ac3) - An Apollo Client 3 based example application that uses React for its view layer, and webpack with tree shaking, to build its production bundle.

## Bundling Metrics

This project includes a script that can be run to collect and summarize bundling metrics from the above applications.

**Usage:**
```sh
./bundlesize.sh
```

**Example output:**
```
# Apollo Client application bundle sizes

## Sample React app (deps: @apollo/client, graphql, graphql-tag, react, react-dom)

1. Sizes excluding "react" and "react-dom":

Apollo Client        Build Tool           Tree Shaking         Minified (K)         Gzipped (K)
-                    -                    -                    -                    -
v3                   Rollup               Yes                  138                  37
v2                   Rollup               Yes                  130                  34
-                    -                    -                    -                    -
v3                   Rollup               No                   151                  40
v2                   Rollup               No                   140                  37

2. Sizes including "react" and "react-dom":

Apollo Client        Build Tool           Tree Shaking         Minified (K)         Gzipped (K)
-                    -                    -                    -                    -
v3                   Rollup               Yes                  262                  76
v3                   Webpack              Yes                  266                  76

## Sample no view app (deps: @apollo/client, graphql, graphql-tag)

Apollo Client        Build Tool           Tree Shaking         Minified (K)         Gzipped (K)
-                    -                    -                    -                    -
v3                   Rollup               Yes                  129                  35
v3                   Rollup               No                   158                  43
```

## Reference

- [Rollup tree shaking](https://rollupjs.org/guide/en/#tree-shaking)
- [webpack tree shaking](https://webpack.js.org/guides/tree-shaking/)

