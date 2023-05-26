import { OperationTypeNode } from 'graphql';
import type { DocumentNode } from '../../core';
import { getOperationDefinition } from './getFromAST';

function isOperation(document: DocumentNode, operation: OperationTypeNode) {
  return getOperationDefinition(document)?.operation === operation;
}

export function isMutationOperation(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.MUTATION);
}

export function isQueryOperation(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.QUERY);
}

export function isSubscriptionOperation(document: DocumentNode) {
  return isOperation(document, OperationTypeNode.SUBSCRIPTION);
}
