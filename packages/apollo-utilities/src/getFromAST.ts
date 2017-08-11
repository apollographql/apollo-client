import {
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  ValueNode,
} from 'graphql';
import { assign } from './util/assign';

import { valueToObjectRepresentation } from './storeUtils';

export function getMutationDefinition(
  doc: DocumentNode,
): OperationDefinitionNode {
  checkDocument(doc);

  let mutationDef: OperationDefinitionNode | null = doc.definitions.filter(
    definition =>
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'mutation',
  )[0] as OperationDefinitionNode;

  if (!mutationDef) {
    throw new Error('Must contain a mutation definition.');
  }

  return mutationDef;
}

// Checks the document for errors and throws an exception if there is an error.
export function checkDocument(doc: DocumentNode) {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  let foundOperation = false;

  doc.definitions.forEach(definition => {
    switch (definition.kind) {
      // If this is a fragment that’s fine.
      case 'FragmentDefinition':
        break;
      // We can only find one operation, so the first time nothing happens. The second time we
      // encounter an operation definition we throw an error.
      case 'OperationDefinition':
        if (foundOperation) {
          throw new Error(
            'Queries must have exactly one operation definition.',
          );
        }
        foundOperation = true;
        break;
      // If this is any other operation kind, throw an error.
      default:
        throw new Error(
          `Schema type definitions not allowed in queries. Found: "${definition.kind}"`,
        );
    }
  });
}

export function getOperationName(doc: DocumentNode): string | undefined {
  return doc.definitions
    .filter(
      definition =>
        definition.kind === 'OperationDefinition' && definition.name,
    )
    .map((x: OperationDefinitionNode) => x.name.value)[0];
}

// Returns the FragmentDefinitions from a particular document as an array
export function getFragmentDefinitions(
  doc: DocumentNode,
): FragmentDefinitionNode[] {
  return doc.definitions.filter(
    definition => definition.kind === 'FragmentDefinition',
  ) as FragmentDefinitionNode[];
}

export function getQueryDefinition(doc: DocumentNode): OperationDefinitionNode {
  checkDocument(doc);

  let queryDef: OperationDefinitionNode | null = doc.definitions.filter(
    definition =>
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'query',
  )[0] as OperationDefinitionNode;

  if (!queryDef) {
    throw new Error('Must contain a query definition.');
  }

  return queryDef;
}

export function getOperationDefinition(
  doc: DocumentNode,
): OperationDefinitionNode {
  checkDocument(doc);

  let opDef: OperationDefinitionNode | null = doc.definitions.filter(
    definition => definition.kind === 'OperationDefinition',
  )[0] as OperationDefinitionNode;
  if (!opDef) {
    throw new Error('Must contain a query definition.');
  }
  return opDef;
}

export function getFragmentDefinition(
  doc: DocumentNode,
): FragmentDefinitionNode {
  if (doc.kind !== 'Document') {
    throw new Error(`Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`);
  }

  if (doc.definitions.length > 1) {
    throw new Error('Fragment must have exactly one definition.');
  }

  const fragmentDef = doc.definitions[0] as FragmentDefinitionNode;

  if (fragmentDef.kind !== 'FragmentDefinition') {
    throw new Error('Must be a fragment definition.');
  }

  return fragmentDef as FragmentDefinitionNode;
}

/**
 * Returns the first operation definition found in this document.
 * If no operation definition is found, the first fragment definition will be returned.
 * If no definitions are found, an error will be thrown.
 */
export function getMainDefinition(
  queryDoc: DocumentNode,
): OperationDefinitionNode | FragmentDefinitionNode {
  checkDocument(queryDoc);

  let fragmentDefinition;

  for (let definition of queryDoc.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const operation = (definition as OperationDefinitionNode).operation;
      if (
        operation === 'query' ||
        operation === 'mutation' ||
        operation === 'subscription'
      ) {
        return definition as OperationDefinitionNode;
      }
    }
    if (definition.kind === 'FragmentDefinition' && !fragmentDefinition) {
      // we do this because we want to allow multiple fragment definitions
      // to precede an operation definition.
      fragmentDefinition = definition as FragmentDefinitionNode;
    }
  }

  if (fragmentDefinition) {
    return fragmentDefinition;
  }

  throw new Error(
    'Expected a parsed GraphQL query with a query, mutation, subscription, or a fragment.',
  );
}

/**
 * This is an interface that describes a map from fragment names to fragment definitions.
 */
export interface FragmentMap {
  [fragmentName: string]: FragmentDefinitionNode;
}

// Utility function that takes a list of fragment definitions and makes a hash out of them
// that maps the name of the fragment to the fragment definition.
export function createFragmentMap(
  fragments: FragmentDefinitionNode[] = [],
): FragmentMap {
  const symTable: FragmentMap = {};
  fragments.forEach(fragment => {
    symTable[fragment.name.value] = fragment;
  });

  return symTable;
}

export function getDefaultValues(
  definition: OperationDefinitionNode,
): { [key: string]: any } {
  if (definition.variableDefinitions && definition.variableDefinitions.length) {
    const defaultValues = definition.variableDefinitions
      .filter(({ defaultValue }) => defaultValue)
      .map(({ variable, defaultValue }): { [key: string]: any } => {
        const defaultValueObj: { [key: string]: any } = {};
        valueToObjectRepresentation(
          defaultValueObj,
          variable.name,
          defaultValue as ValueNode,
        );

        return defaultValueObj;
      });

    return assign({}, ...defaultValues);
  }

  return {};
}
