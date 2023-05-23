import { OperationTypeNode } from 'graphql';
import type { DocumentNode } from '../../core';
import { getOperationDefinition } from './getFromAST';

function isOperation(document: DocumentNode, operation: OperationTypeNode) {
  return getOperationDefinition(document)?.operation === operation;
}

export function isMutation(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.MUTATION);
}

export function isQuery(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.QUERY);
}

export function isSubscription(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.SUBSCRIPTION);
}
