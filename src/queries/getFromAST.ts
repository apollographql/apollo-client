import {
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  ValueNode,
} from 'graphql';


import {
  valueToObjectRepresentation,
} from '../data/storeUtils';

import { assign } from '../util/assign';

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

/**
 * Returns a query document which adds a single query operation that only
 * spreads the target fragment inside of it.
 *
 * So for example a document of:
 *
 * ```graphql
 * fragment foo on Foo { a b c }
 * ```
 *
 * Turns into:
 *
 * ```graphql
 * { ...foo }
 *
 * fragment foo on Foo { a b c }
 * ```
 *
 * The target fragment will either be the only fragment in the document, or a
 * fragment specified by the provided `fragmentName`. If there is more then one
 * fragment, but a `fragmentName` was not defined then an error will be thrown.
 */
export function getFragmentQueryDocument(document: DocumentNode, fragmentName?: string): DocumentNode {
  let actualFragmentName = fragmentName;

  // Build an array of all our fragment definitions that will be used for
  // validations. We also do some validations on the other definitions in the
  // document while building this list.
  const fragments: Array<FragmentDefinitionNode> = [];
  document.definitions.forEach(definition => {
    // Throw an error if we encounter an operation definition because we will
    // define our own operation definition later on.
    if (definition.kind === 'OperationDefinition') {
      throw new Error(
        `Found a ${definition.operation} operation${definition.name ? ` named '${definition.name.value}'` : ''}. ` +
        'No operations are allowed when using a fragment as a query. Only fragments are allowed.',
      );
    }
    // Add our definition to the fragments array if it is a fragment
    // definition.
    if (definition.kind === 'FragmentDefinition') {
      fragments.push(definition);
    }
  });

  // If the user did not give us a fragment name then let us try to get a
  // name from a single fragment in the definition.
  if (typeof actualFragmentName === 'undefined') {
    if (fragments.length !== 1) {
      throw new Error(`Found ${fragments.length} fragments. \`fragmentName\` must be provided when there is not exactly 1 fragment.`);
    }
    actualFragmentName = fragments[0].name.value;
  }

  // Generate a query document with an operation that simply spreads the
  // fragment inside of it.
  const query: DocumentNode = {
    ...document,
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: 'query',
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              kind: 'FragmentSpread',
              name: {
                kind: 'Name',
                value: actualFragmentName,
              },
            },
          ],
        },
      },
      ...document.definitions,
    ],
  };

  return query;
}

export function getDefaultValues(definition: OperationDefinitionNode): { [key: string]: any } {
  if (definition.variableDefinitions && definition.variableDefinitions.length) {
    const defaultValues = definition.variableDefinitions
      .filter(({ defaultValue }) => defaultValue)
      .map(({ variable, defaultValue }) : { [key: string]: any } => {
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
