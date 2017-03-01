export interface AfterwareResponse {
  response: Response;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(response: AfterwareResponse, next: Function): any;
}

export interface BatchAfterwareResponse {
  responses: Response[];
  options: RequestInit;
}

export interface BatchAfterwareInterface {
  applyBatchAfterware(response: BatchAfterwareResponse, next: Function): any;
}
