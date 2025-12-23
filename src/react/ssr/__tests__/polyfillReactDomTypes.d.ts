/* eslint-disable local-rules/no-duplicate-exports */
declare module "react-dom/static.node" {
  export {
    prerenderToNodeStream,
    resumeAndPrerenderToNodeStream,
  } from "react-dom/static";
}
declare module "react-dom/static.browser" {
  export { prerender, resumeAndPrerender } from "react-dom/static";
}
