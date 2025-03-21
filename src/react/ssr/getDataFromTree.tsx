import type * as ReactTypes from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ApolloClient } from "@apollo/client/core";
import { getApolloContext } from "@apollo/client/react/context";

import { RenderPromises } from "./RenderPromises.js";

export function getDataFromTree(
  tree: ReactTypes.ReactNode,
  context: { [key: string]: any } = {}
) {
  return getMarkupFromTree({
    tree,
    context,
    // If you need to configure this renderFunction, call getMarkupFromTree
    // directly instead of getDataFromTree.
    renderFunction: renderToStaticMarkup,
  });
}

type GetMarkupFromTreeOptions = {
  tree: ReactTypes.ReactNode;
  context?: { [key: string]: any };
  renderFunction?: (
    tree: ReactTypes.ReactElement<any>
  ) => string | PromiseLike<string>;
};

export function getMarkupFromTree({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction = renderToStaticMarkup,
}: GetMarkupFromTreeOptions): Promise<string> {
  const renderPromises = new RenderPromises();
  let client: ApolloClient | undefined,
    initialDisableNetworkFetches: boolean | undefined;

  function process(): Promise<string> {
    // Always re-render from the rootElement, even though it might seem
    // better to render the children of the component responsible for the
    // promise, because it is not possible to reconstruct the full context
    // of the original rendering (including all unknown context provider
    // elements) for a subtree of the original component tree.
    const ApolloContext = getApolloContext();

    return new Promise<string>((resolve) => {
      const element = (
        <ApolloContext.Consumer>
          {(value) => {
            if (value.client && !client) {
              client = value.client;
              initialDisableNetworkFetches = value.client.disableNetworkFetches;
              client.disableNetworkFetches = true;
            }
            return (
              <ApolloContext.Provider
                value={{ ...value, renderPromises }}
                children={tree}
              />
            );
          }}
        </ApolloContext.Consumer>
      );

      resolve(renderFunction(element));
    })
      .then((html) => {
        return renderPromises.hasPromises() ?
            renderPromises.consumeAndAwaitPromises().then(process)
          : html;
      })
      .finally(() => {
        renderPromises.stop();
        if (client) {
          client.disableNetworkFetches = initialDisableNetworkFetches!;
        }
      });
  }

  return Promise.resolve().then(process);
}
