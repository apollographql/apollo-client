/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />
/// <reference path="../typings/browser/definitions/lodash/index.d.ts" />

import { parse } from 'graphql';
import {
  Definition,
  OperationDefinition,
  Document,
  FragmentDefinition
} from 'graphql';
import { isString } from 'lodash';

export function parseIfString(doc: Document | string): Document {
  let parsed: Document;

  if (isString(doc)) {
    parsed = parse(doc);
  } else {
    parsed = doc;
  }

  if (!parsed || parsed.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  return parsed;
}

export function parseFragmentIfString(fragment:  Document | string): FragmentDefinition {
  const parsedFragment: Document = parseIfString(fragment);

  if (parsedFragment.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }

  if (parsedFragment.definitions[0].kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment.');
  }

  const fragmentDef: FragmentDefinition = parsedFragment.definitions[0];

  return fragmentDef;
}

export function parseQueryIfString(query:  Document | string): OperationDefinition {
  const parsedQuery: Document = parseIfString(query);

  if (parsedQuery.kind !== 'Document' && parsedQuery.definitions.length !== 1) {
    throw new Error('Must have exactly one definition in document.');
  }
  
  const queryDefinition: OperationDefinition = parsedQuery.definitions[0];
  
  if (queryDefinition.operation !== 'query') {
    throw new Error('Definition must be a query.');
  }

  return queryDefinition;
}
