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

import { GraphQLError, print } from "graphql";
import type { Client } from "graphql-ws";

import { ApolloLink, Operation, FetchResult } from "../core";
import { Observable } from "../../utilities";
import { ApolloError } from "../../errors";

function isLikeCloseEvent(err: unknown): err is Event & {target: WebSocket } {
  return err instanceof Event && err.target instanceof WebSocket && err.target.readyState === WebSocket.CLOSED;
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
          error: (err: any) => {
            if (err instanceof Error) {
              return observer.error(err);
            }

            if (isLikeCloseEvent(err)) {
              // reason will be available on clean closes
              let msg = 'GraphQL WebSocket connection closed.';
              if ('code' in err) msg += ' Code: ' + err.code;
              if ('reason' in err) msg += ' Reason: ' + err.reason;
              return observer.error(new ApolloError({ networkError: new Error(msg) }));
            }

            const errArray = Array.isArray(err) ? err : [err];
            if (errArray.every((err) => err instanceof GraphQLError)) {
              return observer.error(
                new ApolloError({ graphQLErrors: errArray })
              );
            }

            return observer.error(
              new Error("An unknown error occurred on the GraphQL WebSocket link")
            );
          },
        }
      );
    });
  }
}
