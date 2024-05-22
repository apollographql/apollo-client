import type * as ReactTypes from "react";

import type { ObservableQuery, OperationVariables } from "../../core/index.js";
import type { QueryDataOptions } from "../types/types.js";
import { Trie } from "@wry/trie";
import { canonicalStringify } from "../../cache/index.js";

// TODO: A vestigial interface from when hooks were implemented with utility
// classes, which should be deleted in the future.
interface QueryData {
  getOptions(): any;
  fetchData(): Promise<void>;
}

type QueryInfo = {
  seen: boolean;
  observable: ObservableQuery<any, any> | null;
};

function makeQueryInfoTrie() {
  // these Tries are very short-lived, so we don't need to worry about making it
  // "weak" - it's easier to test and debug as a strong Trie.
  return new Trie<QueryInfo>(false, () => ({
    seen: false,
    observable: null,
  }));
}

export class RenderPromises {
  // Map from Query component instances to pending fetchData promises.
  private queryPromises = new Map<QueryDataOptions<any, any>, Promise<any>>();

  // Two-layered map from (query document, stringified variables) to QueryInfo
  // objects. These QueryInfo objects are intended to survive through the whole
  // getMarkupFromTree process, whereas specific Query instances do not survive
  // beyond a single call to renderToStaticMarkup.
  private queryInfoTrie = makeQueryInfoTrie();

  private stopped = false;
  public stop() {
    if (!this.stopped) {
      this.queryPromises.clear();
      this.queryInfoTrie = makeQueryInfoTrie();
      this.stopped = true;
    }
  }

  // Registers the server side rendered observable.
  public registerSSRObservable<TData, TVariables extends OperationVariables>(
    observable: ObservableQuery<any, TVariables>
  ) {
    if (this.stopped) return;
    this.lookupQueryInfo(observable.options).observable = observable;
  }

  // Get's the cached observable that matches the SSR Query instances query and variables.
  public getSSRObservable<TData, TVariables extends OperationVariables>(
    props: QueryDataOptions<TData, TVariables>
  ): ObservableQuery<any, TVariables> | null {
    return this.lookupQueryInfo(props).observable;
  }

  public addQueryPromise(
    queryInstance: QueryData,
    finish?: () => ReactTypes.ReactNode
  ): ReactTypes.ReactNode {
    if (!this.stopped) {
      const info = this.lookupQueryInfo(queryInstance.getOptions());
      if (!info.seen) {
        this.queryPromises.set(
          queryInstance.getOptions(),
          new Promise((resolve) => {
            resolve(queryInstance.fetchData());
          })
        );
        // Render null to abandon this subtree for this rendering, so that we
        // can wait for the data to arrive.
        return null;
      }
    }
    return finish ? finish() : null;
  }

  public addObservableQueryPromise<
    TData,
    TVariables extends OperationVariables,
  >(obsQuery: ObservableQuery<TData, TVariables>) {
    return this.addQueryPromise({
      // The only options which seem to actually be used by the
      // RenderPromises class are query and variables.
      getOptions: () => obsQuery.options,
      fetchData: () =>
        new Promise<void>((resolve) => {
          const sub = obsQuery.subscribe({
            next(result) {
              if (!result.loading) {
                resolve();
                sub.unsubscribe();
              }
            },
            error() {
              resolve();
              sub.unsubscribe();
            },
            complete() {
              resolve();
            },
          });
        }),
    });
  }

  public hasPromises() {
    return this.queryPromises.size > 0;
  }

  public consumeAndAwaitPromises() {
    const promises: Promise<any>[] = [];
    this.queryPromises.forEach((promise, queryInstance) => {
      // Make sure we never try to call fetchData for this query document and
      // these variables again. Since the queryInstance objects change with
      // every rendering, deduplicating them by query and variables is the
      // best we can do. If a different Query component happens to have the
      // same query document and variables, it will be immediately rendered
      // by calling finish() in addQueryPromise, which could result in the
      // rendering of an unwanted loading state, but that's not nearly as bad
      // as getting stuck in an infinite rendering loop because we kept calling
      // queryInstance.fetchData for the same Query component indefinitely.
      this.lookupQueryInfo(queryInstance).seen = true;
      promises.push(promise);
    });
    this.queryPromises.clear();
    return Promise.all(promises);
  }

  private lookupQueryInfo<TData, TVariables extends OperationVariables>(
    props: QueryDataOptions<TData, TVariables>
  ): QueryInfo {
    return this.queryInfoTrie.lookup(
      props.query,
      canonicalStringify(props.variables)
    );
  }
}
