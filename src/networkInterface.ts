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
  query(request: Request): Promise<GraphQLResult>;
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

  function query(request: Request): Promise<GraphQLResult> {
    return fetchFromRemoteEndpoint(request)
      .then(result => result.json())
      .then((payload: GraphQLResult) => {
        if (!payload.hasOwnProperty('data') && !payload.hasOwnProperty('errors')) {
          throw new Error(
            `Server response was missing for query '${request.debugName}'.`
          );
        } else {
          return payload as GraphQLResult;
        }
      });
  };

  return {
    _uri,
    _opts,
    query,
  };
}
