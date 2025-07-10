import * as React from "rehackt";
import type * as ReactTypes from "react";
import { getApolloContext } from "../context/index.js";
import { RenderPromises } from "./RenderPromises.js";
import { renderToStaticMarkup } from "react-dom/server";
import type { BatchOptions } from "./types.js";

export function getDataFromTree(
  tree: ReactTypes.ReactNode,
  context: { [key: string]: any } = {},
  batchOptions?: BatchOptions
) {
  return getMarkupFromTree({
    tree,
    context,
    // If you need to configure this renderFunction, call getMarkupFromTree
    // directly instead of getDataFromTree.
    renderFunction: renderToStaticMarkup,
    batchOptions,
  });
}

export type GetMarkupFromTreeOptions = {
  tree: ReactTypes.ReactNode;
  context?: { [key: string]: any };
  renderFunction?: (
    tree: ReactTypes.ReactElement<any>
  ) => string | PromiseLike<string>;
  batchOptions?: BatchOptions;
};

export function getMarkupFromTree({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction = renderToStaticMarkup,
  batchOptions,
}: GetMarkupFromTreeOptions): Promise<string> {
  const renderPromises = new RenderPromises();
  let iterationCount = 0;
  const MAX_ITERATIONS = 50; // Prevent infinite loops

  function process(): Promise<string> {
    // Always re-render from the rootElement, even though it might seem
    // better to render the children of the component responsible for the
    // promise, because it is not possible to reconstruct the full context
    // of the original rendering (including all unknown context provider
    // elements) for a subtree of the original component tree.
    const ApolloContext = getApolloContext();

    return new Promise<string>((resolve) => {
      const element = React.createElement(
        ApolloContext.Provider,
        { value: { ...context, renderPromises } },
        tree
      );
      resolve(renderFunction(element));
    })
      .then((html) => {
        return renderPromises.hasPromises() ?
            renderPromises
              .consumeAndAwaitPromises({ batchOptions })
              .then(() => {
                iterationCount++;

                // Safety check to prevent infinite loops
                if (iterationCount > MAX_ITERATIONS) {
                  console.warn(
                    `SSR: Exceeded maximum iterations (${MAX_ITERATIONS}). ` +
                      `This might indicate an infinite loop in the SSR process. ` +
                      `Consider checking for queries that never resolve or circular dependencies.`
                  );
                  return html; // Return current HTML to prevent infinite loop
                }

                // If we still have promises after consumption, something went wrong
                if (renderPromises.hasPromises()) {
                  console.warn(
                    "SSR: Still have promises after consumption, this might indicate a bug. " +
                      "Continuing with next iteration..."
                  );
                }

                return process();
              })
              .catch((error) => {
                console.error("SSR: Error during promise consumption:", error);
                // Return current HTML on error to prevent complete failure
                return html;
              })
          : html;
      })
      .finally(() => {
        renderPromises.stop();
      });
  }

  return Promise.resolve().then(process);
}
