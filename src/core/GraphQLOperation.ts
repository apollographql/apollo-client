import type { DocumentNode } from 'graphql';
import type { DefaultContext, OperationVariables } from './types.js';
import type { GraphQLRequest } from '../link/core/index.js';
import type { LocalState } from './LocalState.js';
import {
  getOperationName,
  print,
  removeDirectivesFromDocument,
} from '../utilities/index.js';

interface RawOperation {
  query: DocumentNode;
  variables: OperationVariables | undefined;
  context: DefaultContext | undefined;
}

export class GraphQLOperation {
  query: DocumentNode;
  variables: OperationVariables | undefined;
  context: DefaultContext | undefined;

  constructor(operation: RawOperation) {
    this.query = operation.query;
    this.variables = operation.variables;
    this.context = operation.context;
  }

  get operationName() {
    return getOperationName(this.query) || void 0;
  }

  clone(operation: Partial<RawOperation>) {
    return new GraphQLOperation({
      query: operation.query || this.query,
      variables: operation.variables || this.variables,
      context: operation.context || this.context,
    });
  }

  printQuery() {
    return print(this.query);
  }

  setContext(
    next: ((current: DefaultContext) => DefaultContext) | DefaultContext
  ) {
    this.context =
      typeof next === 'function'
        ? { ...this.context, ...next({ ...this.context }) }
        : { ...this.context, ...next };

    return this;
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

// TODO: Add a cache around this functionality
export function getServerOperation(operation: GraphQLOperation) {
  const query = removeDirectivesFromDocument(
    [
      { name: 'client', remove: true },
      { name: 'connection' },
      { name: 'nonreactive' },
    ],
    operation.query
  );

  if (query) {
    return operation.clone({ query });
  }

  return null;
}

// TODO: Add a cache around this functionality
export function getClientOperation(
  operation: GraphQLOperation,
  localState: LocalState<unknown>
) {
  const query = localState.clientQuery(operation.query);

  if (query) {
    return operation.clone({ query });
  }

  return null;
}
