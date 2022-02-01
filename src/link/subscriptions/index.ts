// This file is adapted from sample code in the README of the graphql-ws npm package:
// https://github.com/enisdenjo/graphql-ws
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

import { print } from "graphql";
import { createClient, ClientOptions, Client } from "graphql-ws";

import { ApolloLink, Operation, FetchResult } from "../core";
import { Observable } from "../../utilities";
import { ApolloError } from "../../errors";

export class GraphQLWsLink extends ApolloLink {
  private client: Client;

  constructor(optionsOrClient: ClientOptions | Client) {
    super();
    this.client =
      // Client is an interface, not a class, so we can't use instanceof here
      "subscribe" in optionsOrClient
        ? optionsOrClient
        : createClient(optionsOrClient);
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

            if (err instanceof CloseEvent) {
              return observer.error(
                // reason will be available on clean closes
                new Error(
                  `Socket closed with event ${err.code} ${err.reason || ""}`
                )
              );
            }

            return observer.error(
              new ApolloError({
                graphQLErrors: Array.isArray(err) ? err : [err],
              })
            );
          },
        }
      );
    });
  }
}
