import { parse } from 'graphql';

import {
  OperationDefinition,
  Document,
  FragmentDefinition,
} from 'graphql';

export function parseDocument(doc: string): Document {
  const parsed = parse(doc);

  if (!parsed || parsed.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  return parsed;
}

export function parseFragment(fragment: string): FragmentDefinition {
  const parsedFragment: Document = parseDocument(fragment);

  if (parsedFragment.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  if (parsedFragment.definitions[0].kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  const fragmentDef: FragmentDefinition = parsedFragment.definitions[0] as FragmentDefinition;

  return fragmentDef;
}

export function parseQuery(query: string): OperationDefinition {
  const parsedQuery: Document = parseDocument(query);

  if (parsedQuery.kind !== 'Document' && parsedQuery.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  const queryDefinition: OperationDefinition = parsedQuery.definitions[0] as OperationDefinition;

  if (queryDefinition.operation !== 'query') {
    throw new Error('Definition must be a query.');
  }

  return queryDefinition;
}

export function parseMutation(mutation: string): OperationDefinition {
  const parsedMutation: Document = parseDocument(mutation);

  if (parsedMutation.kind !== 'Document' && parsedMutation.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  const mutationDefinition: OperationDefinition =
    parsedMutation.definitions[0] as OperationDefinition;

  if (mutationDefinition.operation !== 'mutation') {
    throw new Error('Definition must be a query.');
  }

  return mutationDefinition;
}
