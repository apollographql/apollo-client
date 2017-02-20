export interface AfterwareResponse {
  response: IResponse;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(response: AfterwareResponse, next: Function): any;
}

export interface BatchAfterwareResponse {
  responses: IResponse[];
  options: RequestInit;
}

export interface BatchAfterwareInterface {
  applyBatchAfterware(response: BatchAfterwareResponse, next: Function): any;
}
