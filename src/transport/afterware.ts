import { NetworkInterface } from './networkInterface';

export interface AfterwareResponse {
  response: Response;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(this: NetworkInterface, response: AfterwareResponse, next: Function): any;
}

export interface BatchAfterwareResponse {
  responses: Response[];
  options: RequestInit;
}

export interface BatchAfterwareInterface {
  applyBatchAfterware(this: NetworkInterface, response: BatchAfterwareResponse, next: Function): any;
}
