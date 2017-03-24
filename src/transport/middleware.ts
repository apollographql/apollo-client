import { Request, HTTPFetchNetworkInterface } from './networkInterface';
import { HTTPBatchedNetworkInterface } from './batchedNetworkInterface';


export interface MiddlewareRequest {
  request: Request;
  options: RequestInit;
}

export interface MiddlewareInterface {
  applyMiddleware(this: HTTPFetchNetworkInterface, request: MiddlewareRequest, next: Function): void;
}

export interface BatchMiddlewareRequest {
  requests: Request[];
  options: RequestInit;
}

export interface BatchMiddlewareInterface {
  applyBatchMiddleware(this: HTTPBatchedNetworkInterface, request: BatchMiddlewareRequest, next: Function): void;
}
