import { print } from "graphql";
import type * as ReactTypes from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { filter, firstValueFrom } from "rxjs";

import type {
  DocumentNode,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client/core";
import { getApolloContext } from "@apollo/client/react/context";
import { wrapperSymbol } from "@apollo/client/react/internal";
import { canonicalStringify } from "@apollo/client/utilities";

import { useSSRQuery } from "./useSSRQuery.js";

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

type ObservableQueryKey = `${string}|${string}`;
function getObservableQueryKey(
  query: DocumentNode,
  variables: Record<string, any> = {}
): ObservableQueryKey {
  const queryKey = print(query);
  const variablesKey = canonicalStringify(variables);
  return `${queryKey}|${variablesKey}`;
}
export interface GetMarkupFromTreeContext {
  getObservableQuery(
    query: DocumentNode,
    variables?: Record<string, any>
  ): ObservableQuery | undefined;
  onCreatedObservableQuery: (
    observable: ObservableQuery,
    query: DocumentNode,
    variables: OperationVariables
  ) => void;
}

export function getMarkupFromTree({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction = renderToStaticMarkup,
}: GetMarkupFromTreeOptions): Promise<string> {
  const availableObservableQueries = new Map<
    ObservableQueryKey,
    ObservableQuery
  >();
  let recentlyCreatedObservableQueries = new Set<ObservableQuery>();
  const internalContext: GetMarkupFromTreeContext = {
    getObservableQuery(query, variables) {
      return availableObservableQueries.get(
        getObservableQueryKey(query, variables)
      );
    },
    onCreatedObservableQuery: (
      observable: ObservableQuery,
      query: DocumentNode,
      variables: OperationVariables
    ) => {
      availableObservableQueries.set(
        getObservableQueryKey(query, variables),
        observable
      );
      if (observable.options.fetchPolicy !== "cache-only") {
        recentlyCreatedObservableQueries.add(observable);
      }
    },
  };

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
        {
          value: {
            ...context,
            [wrapperSymbol]: {
              useQuery: () => useSSRQuery.bind(internalContext),
            },
          },
        },
        tree
      );
      resolve(renderFunction(element));
    }).then((html) => {
      if (recentlyCreatedObservableQueries.size == 0) {
        return html;
      }
      return Promise.all(
        Array.from(recentlyCreatedObservableQueries).map(async (observable) => {
          await firstValueFrom(
            observable.pipe(filter((result) => result.loading === false))
          );

          recentlyCreatedObservableQueries.delete(observable);
        })
      ).then(process);
    });
  }

  return Promise.resolve().then(process);
}
