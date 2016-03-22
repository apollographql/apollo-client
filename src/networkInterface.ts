/// <reference path="../typings/main.d.ts" />

// ensure env has promise support
// this should probably be moved elsewhere / should be part of the extra
// deps for older environemnts
import 'es6-promise';

import 'isomorphic-fetch';

import {
  isString,
  assign,
} from 'lodash';

import { GraphQLResult } from 'graphql';

export interface Request {
  debugName?: string;
  query?: string;
  variables?: Object;
}

export interface NetworkInterface {
  _uri: string;
  _opts: RequestInit;
  query(requests: Array<Request>): Promise<Array<GraphQLResult>>;
}

export function createNetworkInterface(uri: string, opts: RequestInit = {}): NetworkInterface {
  if (!uri) {
    throw new Error('A remote enpdoint is required for a network layer');
  }

  if (!isString(uri)) {
    throw new Error('Remote endpoint must be a string');
  }

  const _uri: string = uri;
  const _opts: RequestInit = assign({}, opts);

  function fetchFromRemoteEndpoint(request: Request): Promise<IResponse> {
    return fetch(uri, assign({}, _opts, {
      body: JSON.stringify(request),
      headers: assign({}, _opts.headers, {
        Accept: '*/*',
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    }));
  };

  function query(requests: Array<Request>): Promise<Array<GraphQLResult>> {
    let clonedRequests = [...requests];

    return Promise.all(clonedRequests.map(request => (
      fetchFromRemoteEndpoint(request)
        .then(result => result.json())
        .then((payload: GraphQLResult) => {
          if (payload.hasOwnProperty('errors')) {
            throw new Error(
              `Server request for query '${request.debugName}'
              failed for the following reasons:\n\n
              ${JSON.stringify(payload.errors)}`
            );
          } else if (!payload.hasOwnProperty('data')) {
            throw new Error(
              `Server response was missing for query '${request.debugName}'.`
            );
          } else {
            return payload;
          }
        })
    )));
  };

  return {
    _uri,
    _opts,
    query,
  };
}
