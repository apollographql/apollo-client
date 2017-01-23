import {
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from 'graphql';


export function getMutationDefinition(doc: DocumentNode): OperationDefinitionNode {
  checkDocument(doc);

  let mutationDef: OperationDefinitionNode | null = null;
  doc.definitions.forEach((definition) => {
    if (definition.kind === 'OperationDefinition'
        && (definition as OperationDefinitionNode).operation === 'mutation') {
      mutationDef = definition as OperationDefinitionNode;
    }
  });

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

  doc.definitions.forEach((definition) => {
    switch (definition.kind) {
      // If this is a fragment that’s fine.
      case 'FragmentDefinition':
        break;
      // We can only find one operation, so the first time nothing happens. The second time we
      // encounter an operation definition we throw an error.
      case 'OperationDefinition':
        if (foundOperation) {
          throw new Error('Queries must have exactly one operation definition.');
        }
        foundOperation = true;
        break;
      // If this is any other operation kind, throw an error.
      default:
        throw new Error(`Schema type definitions not allowed in queries. Found: "${definition.kind}"`);
    }
  });
}

export function getOperationName(doc: DocumentNode): string {
  let res: string = '';
  doc.definitions.forEach((definition) => {
    if (definition.kind === 'OperationDefinition' && definition.name) {
      res = definition.name.value;
    }
  });
  return res;
}

// Returns the FragmentDefinitions from a particular document as an array
export function getFragmentDefinitions(doc: DocumentNode): FragmentDefinitionNode[] {
  let fragmentDefinitions: FragmentDefinitionNode[] = doc.definitions.filter((definition) => {
    if (definition.kind === 'FragmentDefinition') {
      return true;
    } else {
      return false;
    }
  }) as FragmentDefinitionNode[];

  return fragmentDefinitions;
}

export function getQueryDefinition(doc: DocumentNode): OperationDefinitionNode {
  checkDocument(doc);

  let queryDef: OperationDefinitionNode | null = null;
  doc.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition'
       && (definition as OperationDefinitionNode).operation === 'query') {
      queryDef = definition as OperationDefinitionNode;
    }
  });

  if (!queryDef) {
    throw new Error('Must contain a query definition.');
  }

  return queryDef;
}

// TODO REFACTOR: fix this and query/mutation definition to not use map, please.
export function getOperationDefinition(doc: DocumentNode): OperationDefinitionNode {
  checkDocument(doc);

  let opDef: OperationDefinitionNode | null = null;
  doc.definitions.map((definition) => {
    if (definition.kind === 'OperationDefinition') {
      opDef = definition as OperationDefinitionNode;
    }
  });

  if (!opDef) {
    throw new Error('Must contain a query definition.');
  }

  return opDef;
}

export function getFragmentDefinition(doc: DocumentNode): FragmentDefinitionNode {
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
 * This is an interface that describes a map from fragment names to fragment definitions.
 */
export interface FragmentMap {
  [fragmentName: string]: FragmentDefinitionNode;
}

// Utility function that takes a list of fragment definitions and makes a hash out of them
// that maps the name of the fragment to the fragment definition.
export function createFragmentMap(fragments: FragmentDefinitionNode[] = []): FragmentMap {
  const symTable: FragmentMap = {};
  fragments.forEach((fragment) => {
    symTable[fragment.name.value] = fragment;
  });

  return symTable;
}
