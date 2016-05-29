import { Request } from './networkInterface';

export interface MiddlewareRequest {
  request: Request;
  options: RequestInit;
}

export interface MiddlewareInterface {
  applyMiddleware(request: MiddlewareRequest, next: Function);
}
