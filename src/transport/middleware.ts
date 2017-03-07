import { Request, NetworkInterface } from './networkInterface';

export interface MiddlewareRequest {
  request: Request;
  options: RequestInit;
}

export interface MiddlewareInterface {
  applyMiddleware(this: NetworkInterface, request: MiddlewareRequest, next: Function): void;
}

export interface BatchMiddlewareRequest {
  requests: Request[];
  options: RequestInit;
}

export interface BatchMiddlewareInterface {
  applyBatchMiddleware(this: NetworkInterface, request: BatchMiddlewareRequest, next: Function): void;
}
