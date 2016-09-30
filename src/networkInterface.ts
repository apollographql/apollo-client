import isString = require('lodash.isstring');
import assign = require('lodash.assign');
import mapValues = require('lodash.mapvalues');
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

/**
 * This is an interface that describes an GraphQL document to be sent
 * to the server.
 *
 * @param query The GraphQL document to be sent to the server. Note that this can
 * be a mutation document or a query document.
 *
 * @param variables An object that maps from variable names to variable values. These variables
 * can be referenced within the GraphQL document.
 *
 * @param operationName The name of the query or mutation, extracted from the GraphQL document.
 */
export interface Request {
  debugName?: string;
  query?: Document;
  variables?: Object;
  operationName?: string;
  [additionalKey: string]: any;
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
  subscribe(request: Request, handler: (error: any, result: any) => void): number;
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
  use(middlewares: MiddlewareInterface[]): any;
  useAfter(afterwares: AfterwareInterface[]): any;
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
        return this.query(requests[0]).then((result: any) => {
          return Promise.resolve([result]);
        });
      }

      const composedRequest = mergeRequests(requests);
      return this.query(composedRequest).then((composedResult: any) => {
        return unpackMergedResult(composedResult, requests);
      });
    },
  }) as BatchedNetworkInterface;
}

export function printRequest(request: Request): PrintedRequest {
  return mapValues(request, (val: any, key: any) => {
    return key === 'query' ? print(val) : val;
  }) as any as PrintedRequest;
}

export class HTTPFetchNetworkInterface implements NetworkInterface {
  public _uri: string;
  public _opts: RequestInit;
  public _middlewares: MiddlewareInterface[];
  public _afterwares: AfterwareInterface[];

  constructor(uri: string, opts: RequestInit = {}) {
    if (!uri) {
      throw new Error('A remote enpdoint is required for a network layer');
    }

    if (!isString(uri)) {
      throw new Error('Remote endpoint must be a string');
    }

    this._uri = uri;
    this._opts = assign({}, opts);
    this._middlewares = [];
    this._afterwares = [];
  }

  public applyMiddlewares({
    request,
    options,
  }: RequestAndOptions): Promise<RequestAndOptions> {
    return new Promise((resolve, reject) => {
      const queue = (funcs: MiddlewareInterface[], scope: any) => {
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
      queue([...this._middlewares], this);
    });
  }

  public applyAfterwares({
    response,
    options,
  }: ResponseAndOptions): Promise<ResponseAndOptions> {
    return new Promise((resolve, reject) => {
      const queue = (funcs: any[], scope: any) => {
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
      queue([...this._afterwares], this);
    });
  }

  public fetchFromRemoteEndpoint({
    request,
    options,
  }: RequestAndOptions): Promise<IResponse> {
    return fetch(this._uri, assign({}, this._opts, {
      body: JSON.stringify(printRequest(request)),
      method: 'POST',
    }, options, {
      headers: assign({}, {
        Accept: '*/*',
        'Content-Type': 'application/json',
      }, options.headers),
    }));
  };

  public query(request: Request): Promise<GraphQLResult> {
    const options = assign({}, this._opts);

    return this.applyMiddlewares({
      request,
      options,
    }).then(this.fetchFromRemoteEndpoint.bind(this))
      .then(response => {
        this.applyAfterwares({
          response: response as IResponse,
          options,
        });
        return response;
      })
      .then(result => (result as IResponse).json())
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

  public use(middlewares: MiddlewareInterface[]) {
    middlewares.map((middleware) => {
      if (typeof middleware.applyMiddleware === 'function') {
        this._middlewares.push(middleware);
      } else {
        throw new Error('Middleware must implement the applyMiddleware function');
      }
    });
  }

  public useAfter(afterwares: AfterwareInterface[]) {
    afterwares.map(afterware => {
      if (typeof afterware.applyAfterware === 'function') {
        this._afterwares.push(afterware);
      } else {
        throw new Error('Afterware must implement the applyAfterware function');
      }
    });
  }
}

// This import has to be placed here due to a bug in TypeScript:
// https://github.com/Microsoft/TypeScript/issues/21
import {
  HTTPBatchedNetworkInterface,
} from './batchedNetworkInterface';


export interface NetworkInterfaceOptions {
  uri: string;
  opts?: RequestInit;
  transportBatching?: boolean;
}

// This function is written to preserve backwards compatibility.
// Specifically, there are two ways of calling `createNetworkInterface`:
// 1. createNetworkInterface(uri: string, opts: RequestInit)
// 2. createnetworkInterface({ uri: string, opts: RequestInit, transportBatching: boolean})
// where the latter is preferred over the former.
//
// XXX remove this backward compatibility feature by 1.0
export function createNetworkInterface(
  interfaceOpts: (NetworkInterfaceOptions | string),
  backOpts: RequestInit = {}
): HTTPNetworkInterface {
  if (isString(interfaceOpts) || !interfaceOpts) {
    const uri = interfaceOpts as string;
    return addQueryMerging(new HTTPFetchNetworkInterface(uri, backOpts)) as HTTPNetworkInterface;
  } else {
    const {
      transportBatching = false,
      opts = {},
      uri,
    } = interfaceOpts as NetworkInterfaceOptions;
    if (transportBatching) {
      // We can use transport batching rather than query merging.
      return new HTTPBatchedNetworkInterface(uri, opts) as HTTPNetworkInterface;
    } else {
      // createNetworkInterface has batching ability by default through query merging,
      // which is not used unless the `shouldBatch` option is passed to apollo-client.
      return addQueryMerging(new HTTPFetchNetworkInterface(uri, opts)) as HTTPNetworkInterface;
    }
  }
}
