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

export function isBatchMiddlewares(
  middlewares: BatchMiddlewareInterface[] | MiddlewareInterface[],
): middlewares is BatchMiddlewareInterface[] {
  // If array is of length 0, then it doesn't matter
  if (middlewares.length === 0) {
    return true;
  }

  return typeof (<BatchMiddlewareInterface[]>middlewares)[0].applyBatchMiddleware === 'function';
}
