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

import { MiddlewareInterface } from './middleware';

export interface Request {
  debugName?: string;
  query?: string;
  variables?: Object;
}

export interface NetworkInterface {
  _uri: string;
  _opts: RequestInit;
  _middlewares: MiddlewareInterface[];
  query(request: Request): Promise<GraphQLResult>;
  use(middlewares: MiddlewareInterface[]);
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
  const _middlewares: MiddlewareInterface[] = [];

  function applyMiddlewares(request: Request): Promise<Request> {
    return new Promise((resolve, reject) => {
      const queue = (funcs, scope) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            f.applyMiddleware.apply(scope, [{ request, options: _opts }, next]);
          } else {
            resolve(request);
          }
        };
        next();
      };

      // iterate through middlewares using next callback
      queue(_middlewares, this);
    });
  }

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
    return applyMiddlewares(request)
      .then(fetchFromRemoteEndpoint)
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

  function use(middlewares: MiddlewareInterface[]) {
    middlewares.map((middleware) => {
      if (typeof middleware.applyMiddleware === 'function') {
        _middlewares.push(middleware);
      } else {
        throw new Error('Middleware must implement the applyMiddleware function');
      }
    });
  }

  return {
    _uri,
    _opts,
    _middlewares,
    query,
    use,
  };
}
