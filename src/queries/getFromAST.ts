import {
  Document,
  OperationDefinition,
  FragmentDefinition,
  SelectionSet,
} from 'graphql';

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

export function getQueryDefinition(doc: Document): OperationDefinition {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  let queryDef;

  doc.definitions.forEach((definition) => {
    if (definition.kind === 'OperationDefinition') {
      if (queryDef) {
        throw new Error('Query must have exactly one operation definition.');
      }

      queryDef = definition;
    }
  });

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

export function getFragmentDefinitions(doc: Document): FragmentDefinition[] {
  if (doc.kind !== 'Document') {
    throw new Error('Expecting a parsed GraphQL document. Perhaps you need to wrap the query string in a "gql" tag?');
  }

  return doc.definitions.filter((definition) => {
    return definition.kind === 'FragmentDefinition';
  }) as FragmentDefinition[];
}

// XXX move this into `gql`
export function inlineFragments(selectionSet: SelectionSet, fragments: FragmentDefinition[]) {

}
