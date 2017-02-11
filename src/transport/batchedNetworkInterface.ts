import {
  ExecutionResult,
} from 'graphql';

import 'whatwg-fetch';

import {
  HTTPFetchNetworkInterface,
  HTTPNetworkInterface,
  RequestAndOptions,
  Request,
  printRequest,
} from './networkInterface';

import {
  QueryBatcher,
} from './batching';

import { assign } from '../util/assign';

export type BatchRequest = Array<Request>;

export interface BatchRequestAndOptions {
  request: BatchRequest;
  options: RequestInit;
}

export interface BatchResponseAndOptions {
  response: IResponse;
  options: RequestInit;
}

// An implementation of the network interface that operates over HTTP and batches
// together requests over the HTTP transport. Note that this implementation will only work correctly
// for GraphQL server implementations that support batching. If such a server is not available, you
// should see `addQueryMerging` instead.
export class HTTPBatchedNetworkInterface extends HTTPFetchNetworkInterface {

  private pollInterval: number;
  private batcher: QueryBatcher;

  constructor(uri: string, pollInterval: number, fetchOpts: RequestInit) {
    super(uri, fetchOpts);

    if (typeof pollInterval !== 'number') {
      throw new Error(`pollInterval must be a number, got ${pollInterval}`);
    }

    this.pollInterval = pollInterval;
    this.batcher = new QueryBatcher({
      batchFetchFunction: this.batchQuery.bind(this),
    });
    this.batcher.start(this.pollInterval);
    // XXX possible leak: when do we stop polling the queue?
  };

  public query(request: Request): Promise<ExecutionResult> {
    // we just pass it through to the batcher.
    return this.batcher.enqueueRequest(request);
  }

  // made public for testing only
  public batchQuery(requests: BatchRequest): Promise<ExecutionResult[]> {
    const options = { ...this._opts };

    // Refine the BatchRequest as a request to satisfy applyMiddlewares signature.
    const request: Request = requests;

    const middlewarePromise: Promise<BatchRequestAndOptions> =
      this.applyMiddlewares({
        request,
        options,
      });

    return new Promise((resolve, reject) => {
      middlewarePromise.then((batchRequestAndOptions: BatchRequestAndOptions) => {
        return this.batchedFetchFromRemoteEndpoint(batchRequestAndOptions)
          .then(result => {
            const httpResponse = result as IResponse;

            if (!httpResponse.ok) {
              const httpError = new Error(`Network request failed with status ${httpResponse.status} - "${httpResponse.statusText}"`);
              (httpError as any).response = httpResponse;

              throw httpError;
            }

            // XXX can we be stricter with the type here?
            return result.json() as any;
          })
          .then(responses => {
            if (typeof responses.map !== 'function') {
              throw new Error('BatchingNetworkInterface: server response is not an array');
            }

            type ResponseAndOptions = {
              response: IResponse;
              options: RequestInit;
            };

            this.applyAfterwares({
              response: responses,
              options: batchRequestAndOptions.options,
            }).then((responseAndOptions: ResponseAndOptions) => {
              // In a batch response, the response is actually an Array of responses, refine it.
              resolve(responseAndOptions.response);
            }).catch((error: Error) => {
              reject(error);
            });
          });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  private batchedFetchFromRemoteEndpoint(
    batchRequestAndOptions: BatchRequestAndOptions,
  ): Promise<IResponse> {
    const options: RequestInit = {};

    // Combine all of the options given by the middleware into one object.
    assign(options, batchRequestAndOptions.options);

    // Refine this back to a BatchRequest (Request[])
    const requests: BatchRequest = batchRequestAndOptions.request;

    // Serialize the requests to strings of JSON
    const printedRequests = requests.map((request) => {
      return printRequest(request);
    });

    return fetch(this._uri, {
      ...this._opts,
      body: JSON.stringify(printedRequests),
      method: 'POST',
      ...options,
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        ...(options.headers as { [headerName: string]: string }),
      },
    });
  };
}

export interface BatchingNetworkInterfaceOptions {
  uri: string;
  batchInterval: number;
  opts?: RequestInit;
}

export function createBatchingNetworkInterface(options: BatchingNetworkInterfaceOptions): HTTPNetworkInterface {
  if (! options) {
    throw new Error('You must pass an options argument to createNetworkInterface.');
  }
  return new HTTPBatchedNetworkInterface(options.uri, options.batchInterval, options.opts || {});
}
