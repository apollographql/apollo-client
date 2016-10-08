export interface AfterwareResponse {
  response: IResponse;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(response: AfterwareResponse, next: Function): any;
}
