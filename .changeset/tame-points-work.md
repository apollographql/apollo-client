---
"@apollo/client": minor
---

Add a new method for static SSR of React components, `prerenderStatic`.
The old methods, `getDataFromTree`, `getMarkupFromTree` and `renderToStringWithData`
have been deprecated in favor of `prerenderStatic`.

If used with React 19 and the `prerender` or `prerenderToNodeStream` apis from
`react-dom/static`, this method can now be used to SSR-prerender suspense-enabled
hook APIs.
