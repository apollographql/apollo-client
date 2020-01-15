import {
  DocumentNode,
  SelectionSetNode,
} from 'graphql';

export function queryFromPojo(obj: any): DocumentNode {
  return {
    kind: 'Document',
    definitions: [{
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'GeneratedClientQuery',
      },
      selectionSet: selectionSetFromObj(obj),
    }],
  };
}

export function fragmentFromPojo(obj: any, typename?: string): DocumentNode {
  return {
    kind: 'Document',
    definitions: [{
      kind: 'FragmentDefinition',
      typeCondition: {
        kind: 'NamedType',
        name: {
          kind: 'Name',
          value: typename || '__FakeType',
        },
      },
      name: {
        kind: 'Name',
        value: 'GeneratedClientQuery',
      },
      selectionSet: selectionSetFromObj(obj),
    }],
  };
}

function selectionSetFromObj(obj: any): SelectionSetNode {
  if (!obj || Object(obj) !== obj) {
    // No selection set here
    return null;
  }

  if (Array.isArray(obj)) {
    // GraphQL queries don't include arrays
    return selectionSetFromObj(obj[0]);
  }

  // Now we know it's an object
  return {
    kind: 'SelectionSet',
    selections: Object.keys(obj).map(key => ({
      kind: 'Field',
      name: {
        kind: 'Name',
        value: key,
      },
      selectionSet: selectionSetFromObj(obj[key]) || void 0,
    })),
  };
}
