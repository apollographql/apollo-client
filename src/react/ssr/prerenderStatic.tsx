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
import { invariant } from "@apollo/client/utilities/invariant";

import { useSSRQuery } from "./useSSRQuery.js";

type ObservableQueryKey = `${string}|${string}`;
function getObservableQueryKey(
  query: DocumentNode,
  variables: Record<string, any> = {}
): ObservableQueryKey {
  const queryKey = print(query);
  const variablesKey = canonicalStringify(variables);
  return `${queryKey}|${variablesKey}`;
}
export interface PrerenderStaticInternalContext {
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

export declare namespace prerenderStatic {
  export interface Options {
    /**
     * The React component tree to prerender
     */
    tree: ReactTypes.ReactNode;
    /**
     * If your app is not wrapped in an `ApolloProvider`, you can pass a `client` instance in here.
     */
    context?: { client?: ApolloClient };
    /**
     * An `AbortSignal` that indicates you want to stop the re-render loop, even if not all data is fetched yet.
     *
     * Note that if you use an api like `prerender` or `prerenderToNodeStream` that supports `AbortSignal` as an option,
     * you will still have to pass that `signal` option to that function by wrapping the `renderFunction`.
     *
     * @example
     * ```ts
     * const result = await prerenderStatic({
     *   tree: <App/>,
     *   signal,
     *   renderFunction: (tree) => prerender(tree, { signal }),
     * })
     * ```
     */
    signal?: AbortSignal;
    /**
     * If this is set, this method will return `""` as the `result` property.
     * Setting this can save CPU time that would otherwise be spent on converting
     * `Uint8Array` or `Buffer` instances to strings for the result.
     */
    ignoreResults?: boolean;
    /**
     * The rendering function to use.
     * These functions are currently supported:
     * * `prerender` from `react-dom/static` (https://react.dev/reference/react-dom/static/prerender)
     *   * recommended if you use Deno or a modern edge runtime with Web Streams
     * * `prerenderToNodeStream` from `react-dom/static` (https://react.dev/reference/react-dom/static/prerenderToNodeStream)
     *   * recommended if you use Node.js
     * * `renderToString` from `react-dom/server` (https://react.dev/reference/react-dom/server/renderToString)
     *   * this API has no suspense support and will not work with hooks like `useSuspenseQuery`
     * * `renderToStaticMarkup` from `react-dom/server` (https://react.dev/reference/react-dom/server/renderToStaticMarkup)
     *   * slightly faster than `renderToString`, but the result cannot be hydrated
     *   * this API has no suspense support and will not work with hooks like `useSuspenseQuery`
     */
    renderFunction:
      | RenderToString
      | RenderToStringPromise
      | PrerenderToWebStream
      | PrerenderToNodeStream
      | ((
          reactNode: ReactTypes.ReactNode
        ) =>
          | ReturnType<RenderToString>
          | ReturnType<RenderToStringPromise>
          | ReturnType<PrerenderToWebStream>
          | ReturnType<PrerenderToNodeStream>);
    /**
     * If this is set to `true`, the result will contain a `diagnostics` property that can help you e.g. detect `useQuery` waterfalls in your application.
     * @default false
     */
    diagnostics?: boolean;

    /**
     * The maximum number of times the tree will be rerendered until no more network requests are made.
     * This is useful to prevent infinite loops in case of a bug in your application.
     * If you have a lot of waterfalls in your application, you might need to increase this number.
     *
     * @default 50
     */
    maxRerenders?: number;
  }

  export interface Result {
    /**
     * The result of the last render, or an empty string if `ignoreResults` was set to `true`.
     */
    result: string;
    /**
     * If the render was aborted early because the `AbortSignal` was cancelled,
     * this will be `true`.
     * If you used a hydratable render function (everything except `renderToStaticMarkup`),
     * the result will still be able to hydrate in the browser, but it might still
     * contain `loading` states and need additional data fetches in the browser.
     */
    aborted: boolean;
    /**
     * If `diagnostics` was set to `true`, this will contain an object with diagnostics that can be used to
     * detect ineffective rendering structures in your app.
     */
    diagnostics?: Diagnostics;
  }

  export interface Diagnostics {
    /**
     * The number of times the tree had to be rerendered until no more network requests
     * were made.
     * A high number here might indicate that you have a waterfall of `useQuery` calls
     * in your application and shows potential for optimization, e.g. via fragment colocation.
     */
    renderCount: number;
  }

  export type RenderToString = (element: ReactTypes.ReactNode) => string;
  export type RenderToStringPromise = (
    element: ReactTypes.ReactNode
  ) => PromiseLike<string>;

  export type PrerenderToWebStream = (
    reactNode: ReactTypes.ReactNode
  ) => Promise<{
    prelude: ReadableStream<Uint8Array>; // AsyncIterable<Uint8Array>;
  }>;

  export type PrerenderToNodeStream = (
    reactNode: ReactTypes.ReactNode
  ) => Promise<{
    prelude: AsyncIterable<string | Buffer>;
  }>;
}

/**
 * This function will rerender your React tree until no more network requests need
 * to be made.
 * If you only use suspenseful hooks (and a suspense-ready `renderFunction`), this
 * means that the tree will be rendered once.
 * If you use non-suspenseful hooks like `useQuery`, this function will render all
 * components, wait for all requests started by your rendered
 * hooks to finish, and then render the tree again, until no more requests are made.
 *
 * After executing this function, you can use `client.extract()` to get a full set
 * of the data that was fetched during these renders.
 * You can then transport that data and hydrate your cache via `client.restore(extractedData)`
 * before hydrating your React tree in the browser.
 */
export function prerenderStatic({
  tree,
  context = {},
  // The rendering function is configurable! We use renderToStaticMarkup as
  // the default, because it's a little less expensive than renderToString,
  // and legacy usage of getDataFromTree ignores the return value anyway.
  renderFunction,
  signal,
  ignoreResults,
  diagnostics,
  maxRerenders = 50,
}: prerenderStatic.Options): Promise<prerenderStatic.Result> {
  const availableObservableQueries = new Map<
    ObservableQueryKey,
    ObservableQuery
  >();
  let recentlyCreatedObservableQueries = new Set<ObservableQuery>();
  let renderCount = 0;

  const internalContext: PrerenderStaticInternalContext = {
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

  async function process(): Promise<prerenderStatic.Result> {
    renderCount++;
    invariant(
      renderCount <= maxRerenders,
      `Exceeded maximum rerender count of %d.
This either means you have very deep \`useQuery\` waterfalls in your application
and need to increase the \`maxRerender\` option to \`prerenderStatic\`, or that
you have an infinite render loop in your application.`,
      maxRerenders
    );

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
    const result = await consume(await renderFunction(element));

    if (recentlyCreatedObservableQueries.size == 0) {
      return { result, aborted: false };
    }
    if (signal?.aborted) {
      return { result, aborted: true };
    }
    await Promise.all(
      Array.from(recentlyCreatedObservableQueries).map(async (observable) => {
        await firstValueFrom(
          observable.pipe(filter((result) => result.loading === false))
        );

        recentlyCreatedObservableQueries.delete(observable);
      })
    );

    if (signal?.aborted) {
      return { result, aborted: true };
    }
    return process();
  }

  if (signal?.aborted) {
    throw new Error("The operation was aborted before it could be attempted.");
  }
  return Promise.resolve()
    .then(process)
    .then((result) =>
      diagnostics ?
        {
          ...result,
          diagnostics: {
            renderCount,
          },
        }
      : result
    )
    .finally(() => {
      availableObservableQueries.clear();
      recentlyCreatedObservableQueries.clear();
    });

  async function consume(
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
          'as well as `prerender` and `prerenderToNodeStream` from "react-dom/static"'
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
