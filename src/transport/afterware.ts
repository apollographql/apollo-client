import { GraphQLResult } from 'graphql';

export interface AfterwareResponse {
  response: GraphQLResult;
  options: RequestInit;
}

export interface AfterwareInterface {
  applyAfterware(response: AfterwareResponse, next: Function): any;
}
