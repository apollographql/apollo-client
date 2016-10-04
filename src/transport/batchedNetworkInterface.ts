import {
  GraphQLResult,
} from 'graphql';

import 'whatwg-fetch';

import assign = require('lodash.assign');
import isNumber = require('lodash.isnumber');

import {
  HTTPFetchNetworkInterface,
  RequestAndOptions,
  Request,
  printRequest,
} from './networkInterface';

import {
  QueryBatcher,
} from './batching';

// An implementation of the network interface that operates over HTTP and batches
// together requests over the HTTP transport. Note that this implementation will only work correctly
// for GraphQL server implementations that support batching. If such a server is not available, you
// should see `addQueryMerging` instead.
export class HTTPBatchedNetworkInterface extends HTTPFetchNetworkInterface {

  private pollInterval: number;
  private batcher: QueryBatcher;

  constructor(uri: string, pollInterval: number, fetchOpts: RequestInit) {
    super(uri, fetchOpts);

    if (!isNumber(pollInterval)) {
      throw new Error(`pollInterval must be a number, got ${pollInterval}`);
    }

    this.pollInterval = pollInterval;
    this.batcher = new QueryBatcher({
      batchFetchFunction: this.batchQuery.bind(this),
    });
    this.batcher.start(this.pollInterval);
    // XXX possible leak: when do we stop polling the queue?
  };

  public query(request: Request): Promise<GraphQLResult> {
    // we just pass it through to the batcher.
    return this.batcher.enqueueRequest(request);
  }

  // made public for testing only
  public batchQuery(requests: Request[]): Promise<GraphQLResult[]> {
    const options = assign({}, this._opts);

    // Apply the middlewares to each of the requests
    const middlewarePromises: Promise<RequestAndOptions>[] = [];
    requests.forEach((request) => {
      middlewarePromises.push(this.applyMiddlewares({
        request,
        options,
      }));
    });

    return new Promise((resolve, reject) => {
      Promise.all(middlewarePromises).then((requestsAndOptions: RequestAndOptions[]) => {
        return this.batchedFetchFromRemoteEndpoint(requestsAndOptions)
          .then(result => {
            return result.json();
          })
          .then(responses => {
            const afterwaresPromises = responses.map((response: IResponse, index: number) => {
              return this.applyAfterwares({
                response,
                options: requestsAndOptions[index].options,
              });
            });

            Promise.all(afterwaresPromises).then((responsesAndOptions: {
              response: IResponse,
              options: RequestInit,
            }[]) => {
              const results: Array<IResponse>  = [];
              responsesAndOptions.forEach(({ response }) => {
                results.push(response);
              });
              resolve(results);
            }).catch((error) => {
              reject(error);
            });
          });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  private batchedFetchFromRemoteEndpoint(
    requestsAndOptions: RequestAndOptions[]
  ): Promise<IResponse> {
    const options: RequestInit = {};

    // Combine all of the options given by the middleware into one object.
    requestsAndOptions.forEach((requestAndOptions) => {
      assign(options, requestAndOptions.options);
    });

    // Serialize the requests to strings of JSON
    const printedRequests = requestsAndOptions.map(({ request }) => {
      return printRequest(request);
    });

    return fetch(this._uri, assign({}, this._opts, options, {
      body: JSON.stringify(printedRequests),
      headers: assign({}, options.headers, {
        Accept: '*/*',
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    }));
  };
}
