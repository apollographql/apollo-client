export interface AfterwareResponse {
  response: Response;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(response: AfterwareResponse, next: Function): any;
}
