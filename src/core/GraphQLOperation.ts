import type { DocumentNode } from 'graphql';
import type {
  DefaultContext,
  OperationVariables,
  TypedDocumentNode,
} from './types.js';
import type { GraphQLRequest } from '../link/core/index.js';
import type { LocalState } from './LocalState.js';
import {
  getOperationName,
  print,
  removeDirectivesFromDocument,
} from '../utilities/index.js';

interface RawOperation<
  TData,
  TVariables extends OperationVariables,
  TContext extends DefaultContext
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables: TVariables | undefined;
  context: TContext | undefined;
}

export class GraphQLOperation<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TContext extends DefaultContext = DefaultContext
> {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  variables: TVariables | undefined;
  context: TContext | undefined;

  static from<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
    TContext extends DefaultContext = DefaultContext
  >(
    other: GraphQLOperation<TData, TVariables, TContext>,
    operation: Partial<RawOperation<TData, TVariables, TContext>>
  ) {
    return new GraphQLOperation({ ...other.toPlainObject(), ...operation });
  }

  constructor(operation: RawOperation<TData, TVariables, TContext>) {
    this.query = operation.query;
    this.variables = operation.variables;
    this.context = operation.context;
  }

  get operationName() {
    return getOperationName(this.query) || void 0;
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

  toPlainObject() {
    return {
      query: this.query,
      variables: this.variables,
      context: this.context,
    };
  }

  toGraphQLRequest(): GraphQLRequest {
    return { ...this.toPlainObject(), operationName: this.operationName };
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

  return query ? GraphQLOperation.from(operation, { query }) : null;
}

// TODO: Add a cache around this functionality
export function getClientOperation(
  operation: GraphQLOperation,
  localState: LocalState<unknown>
) {
  const query = localState.clientQuery(operation.query);

  return query ? GraphQLOperation.from(operation, { query }) : null;
}
