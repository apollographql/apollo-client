import isString = require('lodash.isstring');
import assign = require('lodash.assign');
import 'whatwg-fetch';

import {
  GraphQLResult,
  Document,
} from 'graphql';

import { print } from 'graphql-tag/printer';

import { MiddlewareInterface } from './middleware';
import { AfterwareInterface } from './afterware';

import {
  mergeRequests,
  unpackMergedResult,
} from './batching/queryMerging';

export interface Request {
  debugName?: string;
  query?: Document;
  variables?: Object;
  operationName?: string;
}

// The request representation just before it is converted to JSON
// and sent over the transport.
export interface PrintedRequest {
  debugName?: string;
  query?: string;
  variables?: Object;
  operationName?: string;
}

export interface NetworkInterface {
  [others: string]: any;
  query(request: Request): Promise<GraphQLResult>;
}

export interface SubscriptionNetworkInterface extends NetworkInterface {
  subscribe(request: Request, handler: (error, result) => void): number;
  unsubscribe(id: Number): void;
}

export interface BatchedNetworkInterface extends NetworkInterface {
  batchQuery(requests: Request[]): Promise<GraphQLResult[]>;
}

export interface HTTPNetworkInterface extends BatchedNetworkInterface {
  _uri: string;
  _opts: RequestInit;
  _middlewares: MiddlewareInterface[];
  _afterwares: AfterwareInterface[];
  use(middlewares: MiddlewareInterface[]);
  useAfter(afterwares: AfterwareInterface[]);
}

export interface RequestAndOptions {
  request: Request;
  options: RequestInit;
}

export interface ResponseAndOptions {
  response: IResponse;
  options: RequestInit;
}

// Takes a standard network interface (i.e. not necessarily a BatchedNetworkInterface) and turns
// it into a network interface that supports batching by composing/merging queries in to one
// query.
export function addQueryMerging(networkInterface: NetworkInterface): BatchedNetworkInterface {
  return assign(networkInterface, {
    batchQuery(requests: Request[]): Promise<GraphQLResult[]> {
      // If we a have a single request, there is no point doing any merging
      // at all.
      if (requests.length === 1) {
        return this.query(requests[0]).then((result) => {
          return Promise.resolve([result]);
        });
      }

      const composedRequest = mergeRequests(requests);
      return this.query(composedRequest).then((composedResult) => {
        return unpackMergedResult(composedResult, requests);
      });
    },
  }) as BatchedNetworkInterface;
}

export function addGraphQLSubscriptions(networkInterface: NetworkInterface, wsClient: any): SubscriptionNetworkInterface {
  console.log("adding graphql subs to network");
  return assign(networkInterface, {
    subscribe(request: Request, handler: (error, result) => void) {
      wsClient.subscribe({
        query: print(request.query),
        variables: request.variables,
      }, handler);
    },
    unsubscribe(id: number) {
      wsClient.unsubscribe(id);
    },
  }) as SubscriptionNetworkInterface;
}

export function printRequest(request: Request): PrintedRequest {
  const printedRequest = {
    debugName: request.debugName,
    query: print(request.query),
    variables: request.variables,
    operationName: request.operationName,
  };
  return printedRequest;
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
  const _afterwares: AfterwareInterface[] = [];

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

  function applyAfterwares({
    response,
    options,
  }: ResponseAndOptions): Promise<ResponseAndOptions> {
    return new Promise((resolve, reject) => {
      const queue = (funcs, scope) => {
        const next = () => {
          if (funcs.length > 0) {
            const f = funcs.shift();
            f.applyAfterware.apply(scope, [{ response, options }, next]);
          } else {
            resolve({
              response,
              options,
            });
          }
        };
        next();
      };

      // iterate through afterwares using next callback
      queue([..._afterwares], this);
    });
  }

  function fetchFromRemoteEndpoint({
    request,
    options,
  }: RequestAndOptions): Promise<IResponse> {
    return fetch(uri, assign({}, _opts, options, {
      body: JSON.stringify(printRequest(request)),
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
      .then(response => {
        applyAfterwares({
          response,
          options,
        });
        return response;
      })
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

  function useAfter(afterwares: AfterwareInterface[]) {
    afterwares.map(afterware => {
      if (typeof afterware.applyAfterware === 'function') {
        _afterwares.push(afterware);
      } else {
        throw new Error('Afterware must implement the applyAfterware function');
      }
    });
  }

  // createNetworkInterface has batching ability by default, which is not used unless the
  // `shouldBatch` option is passed to apollo-client
  return addQueryMerging({
    _uri,
    _opts,
    _middlewares,
    _afterwares,
    query,
    use,
    useAfter,
  }) as HTTPNetworkInterface;
}
