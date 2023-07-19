import type { DocumentNode } from 'graphql';
import type { DefaultContext, OperationVariables } from './types.js';
import type { GraphQLRequest } from '../link/core/index.js';
import { getOperationName } from '../utilities/index.js';

interface GraphQLOperationOptions {
  query: DocumentNode;
  variables: OperationVariables | undefined;
  context: DefaultContext | undefined;
}

export class GraphQLOperation {
  query: DocumentNode;
  variables: OperationVariables | undefined;
  context: DefaultContext | undefined;

  constructor(options: GraphQLOperationOptions) {
    this.query = options.query;
    this.variables = options.variables;
    this.context = options.context;
  }

  get operationName() {
    return getOperationName(this.query) || void 0;
  }

  toGraphQLRequest(): GraphQLRequest {
    return {
      query: this.query,
      variables: this.variables,
      operationName: this.operationName,
      context: this.context,
    };
  }
}
