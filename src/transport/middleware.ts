import { Request, HTTPFetchNetworkInterface } from './networkInterface';
import { HTTPBatchNetworkInterface } from './batchNetworkInterface';


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
  applyBatchMiddleware(this: HTTPBatchNetworkInterface, request: BatchMiddlewareRequest, next: Function): void;
}
