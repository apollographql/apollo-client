import { print } from "graphql";
import type * as ReactTypes from "react";
import * as React from "react";
import { filter, firstValueFrom } from "rxjs";

import type {
  ApolloClient,
  DocumentNode,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client/core";
import { getApolloContext } from "@apollo/client/react/context";
import { wrapperSymbol } from "@apollo/client/react/internal";
import { canonicalStringify } from "@apollo/client/utilities";

import { useSSRQuery } from "./useSSRQuery.js";

type RenderToString = (element: ReactTypes.ReactNode) => string;
type RenderToStringPromise = (
  element: ReactTypes.ReactNode
) => PromiseLike<string>;

type PrerenderToWebStream = (reactNode: ReactTypes.ReactNode) => Promise<{
  prelude: ReadableStream<Uint8Array>; // AsyncIterable<Uint8Array>;
}>;

type PrerenderToNodeStream = (reactNode: ReactTypes.ReactNode) => Promise<{
  prelude: AsyncIterable<string | Buffer>;
}>;

type PrerenderStaticOptions = {
  tree: ReactTypes.ReactNode;
  context?: { client?: ApolloClient };
  signal?: AbortSignal;
  ignoreResults?: boolean;
  renderFunction:
    | RenderToString
    | RenderToStringPromise
    | PrerenderToWebStream
    | PrerenderToNodeStream;
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

export function prerenderStatic({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction,
  signal,
  ignoreResults,
}: PrerenderStaticOptions): Promise<{ result: string; aborted: boolean }> {
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

    const element = (
      <ApolloContext.Provider
        value={{
          ...context,
          [wrapperSymbol]: {
            useQuery: () => useSSRQuery.bind(internalContext),
          },
        }}
      >
        {tree}
      </ApolloContext.Provider>
    );
    return Promise.resolve(renderFunction(element))
      .then(decode)
      .then((html) => {
        if (recentlyCreatedObservableQueries.size == 0) {
          return html;
        }
        return Promise.all(
          Array.from(recentlyCreatedObservableQueries).map(
            async (observable) => {
              await firstValueFrom(
                observable.pipe(filter((result) => result.loading === false))
              );

              recentlyCreatedObservableQueries.delete(observable);
            }
          )
        ).then(process);
      });
  }

  if (signal?.aborted) {
    throw new Error("The operation was aborted before it could be attempted.");
  }
  return Promise.resolve()
    .then(process)
    .then((result) => ({
      result: ignoreResults ? "" : result,
      aborted: signal?.aborted ?? false,
    }))
    .finally(() => {
      availableObservableQueries.clear();
      recentlyCreatedObservableQueries.clear();
    });

  async function decode(
    value:
      | string
      | {
          prelude: ReadableStream<Uint8Array>;
        }
      | {
          prelude: AsyncIterable<string | Buffer>;
        }
  ): Promise<string> {
    if (typeof value === "string") {
      return value;
    }
    if (!value.prelude) {
      throw new Error(
        "`getMarkupFromTree` was called with an incompatible render method.\n" +
          'It is compatible with `renderToStaticMarkup` and `renderToString`  from `"react-dom/server"`\n' +
          'as well as `prerender` and `prerenderToNodeStrea` } from "react-dom/static"'
      );
    }
    const prelude = value.prelude;
    let result = "";
    if ("getReader" in prelude) {
      const reader = prelude.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!ignoreResults) {
          result += Buffer.from(value).toString("utf8");
        }
      }
    } else {
      for await (const chunk of prelude) {
        if (!ignoreResults) {
          result +=
            typeof chunk === "string" ? chunk : (
              Buffer.from(chunk).toString("utf8")
            );
        }
      }
    }
    return result;
  }
}
