import { Request } from './networkInterface';

export interface MiddlewareRequest {
  request: Request;
  options: RequestInit;
}

export interface MiddlewareInterface {
  applyMiddleware(request: MiddlewareRequest, next: Function): void;
}

export interface BatchMiddlewareRequest {
  requests: Request[];
  options: RequestInit;
}

export interface BatchMiddlewareInterface {
  applyBatchMiddleware(request: BatchMiddlewareRequest, next: Function): void;
}
