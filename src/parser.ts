import { parse } from 'graphql/language/parser';

import {
  Document,
  Definition,
  OperationDefinition,
  FragmentDefinition,
} from 'graphql';

export function parseDocument(doc: string): Document {
  const parsed = parse(doc);

  if (!parsed || parsed.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  return parsed as Document;
}

function parseDefinition(definition: string): Definition {
  const parsedDocument = parseDocument(definition);

  if (parsedDocument.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  return parsedDocument.definitions[0];
}

export function parseFragment(fragment: string): FragmentDefinition {
  const parsedFragment = parseDefinition(fragment);

  if (parsedFragment.kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  return parsedFragment as FragmentDefinition;
}

export function parseQuery(query: string): OperationDefinition {
  const queryDefinition = parseDefinition(query) as OperationDefinition;

  if (queryDefinition.kind !== 'OperationDefinition' && queryDefinition.operation !== 'query') {
    throw new Error('Definition must be a query.');
  }

  return queryDefinition;
}

export function parseMutation(mutation: string): OperationDefinition {
  const mutationDefinition = parseDefinition(mutation) as OperationDefinition;

  if (mutationDefinition.kind !== 'OperationDefinition' && mutationDefinition.operation !== 'mutation') {
    throw new Error('Definition must be a mutation.');
  }

  return mutationDefinition;
}
