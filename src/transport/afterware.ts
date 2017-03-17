import { HTTPFetchNetworkInterface } from './networkInterface';
import { HTTPBatchedNetworkInterface } from './batchedNetworkInterface';

export interface AfterwareResponse {
  response: Response;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(this: HTTPFetchNetworkInterface, response: AfterwareResponse, next: Function): any;
}

export interface BatchAfterwareResponse {
  responses: Response[];
  options: RequestInit;
}

export interface BatchAfterwareInterface {
  applyBatchAfterware(this: HTTPBatchedNetworkInterface, response: BatchAfterwareResponse, next: Function): any;
}
