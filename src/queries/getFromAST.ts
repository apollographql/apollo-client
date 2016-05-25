import {
  Document,
  OperationDefinition,
  FragmentDefinition,
} from 'graphql';

import countBy = require('lodash.countby');
import identity = require('lodash.identity');

export function getMutationDefinition(doc: Document): OperationDefinition {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  if (doc.definitions.length > 1) {
    throw new Error('Mutation query must have exactly one operation definition.');
  }

  const mutationDef = doc.definitions[0] as OperationDefinition;

  if (mutationDef.kind !== 'OperationDefinition' || mutationDef.operation !== 'mutation') {
    throw new Error('Must be a mutation definition.');
  }

  return mutationDef;
}

// Checks the document for errors and throws an exception if there is an error.
export function checkDocument(doc: Document) {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  const definitionTypes = doc.definitions.map((definition) => {
    return definition.kind;
  });
  const typeCounts = countBy(definitionTypes, identity);

  // can't have more than one operation definition per query
  if (typeCounts['OperationDefinition'] > 1) {
    throw new Error('Queries must have exactly one operation definition.');
  }
}

export function getQueryDefinition(doc: Document): OperationDefinition {
  checkDocument(doc);

  const queryDef = doc.definitions[0] as OperationDefinition;

  if (queryDef.kind !== 'OperationDefinition' || queryDef.operation !== 'query') {
    throw new Error('Must be a query definition.');
  }

  return queryDef as OperationDefinition;
}

export function getFragmentDefinition(doc: Document): FragmentDefinition {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  if (doc.definitions.length > 1) {
    throw new Error('Fragment must have exactly one definition.');
  }

  const fragmentDef = doc.definitions[0] as FragmentDefinition;

  if (fragmentDef.kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment definition.');
  }

  return fragmentDef as FragmentDefinition;
}
