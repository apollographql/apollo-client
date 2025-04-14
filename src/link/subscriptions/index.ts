// This file is adapted from the graphql-ws npm package:
// https://github.com/enisdenjo/graphql-ws
//
// Most of the file comes from that package's README; some other parts (such as
// isLikeCloseEvent) come from its source.
//
// Here's the license of the original code:
//
// The MIT License (MIT)
//
// Copyright (c) 2020-2021 Denis Badurina
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { print } from "../../utilities/index.js";
import type { Client, Sink } from "graphql-ws";

import type { Operation, FetchResult } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import { isNonNullObject, Observable } from "../../utilities/index.js";
import { ApolloError } from "../../errors/index.js";
import type { FormattedExecutionResult } from "graphql";

// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event
function isLikeCloseEvent(val: unknown): val is CloseEvent {
  return isNonNullObject(val) && "code" in val && "reason" in val;
}

// https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event
function isLikeErrorEvent(err: unknown): err is Event {
  return isNonNullObject(err) && err.target?.readyState === WebSocket.CLOSED;
}

export class GraphQLWsLink extends ApolloLink {
  constructor(public readonly client: Client) {
    super();
  }

  public request(operation: Operation): Observable<FetchResult> {
    return new Observable((observer) => {
      return this.client.subscribe<FetchResult>(
        { ...operation, query: print(operation.query) },
        {
          next: observer.next.bind(observer),
          complete: observer.complete.bind(observer),
          error: (err) => {
            if (err instanceof Error) {
              return observer.error(err);
            }
            const likeClose = isLikeCloseEvent(err);
            if (likeClose || isLikeErrorEvent(err)) {
              return observer.error(
                // reason will be available on clean closes
                new Error(
                  `Socket closed${likeClose ? ` with event ${err.code}` : ""}${
                    likeClose ? ` ${err.reason}` : ""
                  }`
                )
              );
            }

            return observer.error(
              new ApolloError({
                graphQLErrors: Array.isArray(err) ? err : [err],
              })
            );
          },
          // casting around a wrong type in graphql-ws, which incorrectly expects `Sink<ExecutionResult>`
        } satisfies Sink<FormattedExecutionResult> as any
      );
    });
  }
}
