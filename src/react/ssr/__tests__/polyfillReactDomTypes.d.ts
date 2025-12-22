/* eslint-disable local-rules/no-duplicate-exports */
declare module "react-dom/static.node" {
  export { prerenderToNodeStream } from "react-dom/static";
}
declare module "react-dom/static.browser" {
  export { prerender } from "react-dom/static";
}
