import isString = require('lodash.isstring');
import assign = require('lodash.assign');

import { GraphQLResult } from 'graphql';

import { MiddlewareInterface } from './middleware';

export interface Request {
  debugName?: string;
  query?: string;
  variables?: Object;
}

export interface NetworkInterface {
  query(request: Request): Promise<GraphQLResult>;
}

export interface HTTPNetworkInterface extends NetworkInterface {
  _uri: string;
  _opts: RequestInit;
  _middlewares: MiddlewareInterface[];
  use(middlewares: MiddlewareInterface[]);
}

export interface RequestAndOptions {
  request: Request;
  options: RequestInit;
}

export function createNetworkInterface(uri: string, opts: RequestInit = {}): HTTPNetworkInterface {
  if (!uri) {
    throw new Error('A remote enpdoint is required for a network layer');
  }

  if (!isString(uri)) {
    throw new Error('Remote endpoint must be a string');
  }

  const _uri: string = uri;
  const _opts: RequestInit = assign({}, opts);
  const _middlewares: MiddlewareInterface[] = [];

  function applyMiddlewares({
    request,
    options,
  }: RequestAndOptions): Promise<RequestAndOptions> {
    return new Promise((resolve, reject) => {
      const queue = (funcs, scope) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            f.applyMiddleware.apply(scope, [{ request, options }, next]);
          } else {
            resolve({
              request,
              options,
            });
          }
        };
        next();
      };

      // iterate through middlewares using next callback
      queue([..._middlewares], this);
    });
  }

  function fetchFromRemoteEndpoint({
    request,
    options,
  }: RequestAndOptions): Promise<IResponse> {
    return fetch(uri, assign({}, _opts, options, {
      body: JSON.stringify(request),
      headers: assign({}, options.headers, {
        Accept: '*/*',
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    }));
  };

  function query(request: Request): Promise<GraphQLResult> {
    const options = assign({}, _opts);

    return applyMiddlewares({
      request,
      options,
    }).then(fetchFromRemoteEndpoint)
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
