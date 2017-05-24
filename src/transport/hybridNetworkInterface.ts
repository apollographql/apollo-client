import { ExecutionResult } from 'graphql';

import {
  createNetworkInterface,
  HTTPNetworkInterface,
  NetworkInterfaceOptions,
  BaseNetworkInterface,
  Request,
} from './networkInterface';

import {
  createBatchingNetworkInterface,
  BatchingNetworkInterfaceOptions,
} from './batchedNetworkInterface';

import { MiddlewareInterface } from './middleware';

import { AfterwareInterface } from './afterware';


export class HTTPHybridNetworkInterface extends BaseNetworkInterface {
  public networkInterface: HTTPNetworkInterface;
  public batchedInterface: HTTPNetworkInterface;

  constructor(options: BatchingNetworkInterfaceOptions) {
    super(options.uri, options.opts);
    this.networkInterface = createNetworkInterface(options);
    this.batchedInterface = createBatchingNetworkInterface(options);
  }

  public query(request: Request): Promise<ExecutionResult> {
    if (request.disableBatch) {
      return this.networkInterface.query(request);
    } else {
      return this.batchedInterface.query(request);
    }
  }

  public use(middlewares: MiddlewareInterface[]): HTTPNetworkInterface {
    this.batchedInterface.use(middlewares);
    this.networkInterface.use(middlewares);
    return this;
  }

  public useAfter(afterwares: AfterwareInterface[]): HTTPNetworkInterface {
    this.batchedInterface.useAfter(afterwares);
    this.networkInterface.useAfter(afterwares);
    return this;
  }
}

export function createHybridNetworkInterface(options: BatchingNetworkInterfaceOptions): HTTPNetworkInterface {
  if (! options) {
    throw new Error('You must pass an options argument to createNetworkInterface.');
  }
  return new HTTPHybridNetworkInterface(options);
}

