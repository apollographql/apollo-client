// == `parser.js` == //
// @flow
import { parse } from 'graphql/language';
import type { Document, Definition } from 'graphql/language/ast';
import { isString } from 'lodash';

export function parseIfString(doc: Document | string): Document {
  let parsed: Document | string = doc;

  if (isString(doc)) {
    parsed = parse(doc);
  }

  if (!parsed || parsed.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  return parsed;
}

export function parseFragmentIfString(fragment: Document | string): Document {
  const parsedFragment: Document = parseIfString(fragment);

  if (parsedFragment.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  if (parsedFragment.definitions[0].kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  const fragmentDef = parsedFragment.definitions[0];

  return fragmentDef;
}

export function parseQueryIfString(query: Document | string): Definition {
  const parsedQuery: Document = parseIfString(query);

  if (parsedQuery.kind !== 'Document' && parsedQuery.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  const queryDefinition: Definition = parsedQuery.definitions[0];

  if (queryDefinition.operation !== 'query') {
    throw new Error('Definition must be a query.');
  }

  return queryDefinition;
}
