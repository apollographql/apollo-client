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

export function isBatchAfterwares(afterwares: BatchAfterwareInterface[] | AfterwareInterface[]): afterwares is BatchAfterwareInterface[] {
  if (afterwares.length === 0) {
    return true;
  }
  return typeof (<BatchAfterwareInterface[]>afterwares)[0].applyBatchAfterware === 'function';
}
