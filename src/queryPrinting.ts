import {
  print,
  SelectionSet,
} from 'graphql';

import {
  MissingSelectionSet,
} from './diffAgainstStore';

export function printQueryForMissingData(missingSelectionSets: MissingSelectionSet[]) {
  const queryDocumentAst = {
    kind: 'Document',
    definitions: [
      queryDefinition(missingSelectionSets),
    ],
  };

  return print(queryDocumentAst);
}

const idField = {
  kind: 'Field',
  alias: null,
  name: {
    kind: 'Name',
    value: 'id',
  },
};

function queryDefinition(missingSelectionSets: MissingSelectionSet[]) {
  const selections = missingSelectionSets.map((missingSelectionSet: MissingSelectionSet, index) => {
    if (missingSelectionSet.id === 'ROOT_QUERY') {
      if (missingSelectionSet.selectionSet.selections.length > 1) {
        throw new Error('Multiple root queries, cannot print that yet.');
      }

      return missingSelectionSet.selectionSet.selections[0];
    }

    return nodeSelection({
      alias: `__node_${index}`,
      id: missingSelectionSet.id,
      typeName: missingSelectionSet.typeName,
      selectionSet: missingSelectionSet.selectionSet,
    });
  });

  return {
    kind: 'OperationDefinition',
    operation: 'query',
    name: null,
    variableDefinitions: null,
    directives: [],
    selectionSet: {
      kind: 'SelectionSet',
      selections,
    },
  };
}

function nodeSelection({
  id,
  typeName,
  selectionSet,
  alias,
}: {
  id: string,
  typeName: string,
  selectionSet: SelectionSet,
  alias?: string,
}) {
  const aliasNode = alias ? {
    kind: 'Name',
    value: alias,
  } : null;

  return {
    kind: 'Field',
    alias: aliasNode,
    name: {
      kind: 'Name',
      value: 'node',
    },
    arguments: [
      {
        kind: 'Argument',
        name: {
          kind: 'Name',
          value: 'id',
        },
        value: {
          kind: 'StringValue',
          value: id,
        },
      },
    ],
    directives: [],
    selectionSet: {
      kind: 'SelectionSet',
      selections: [
        idField,
        inlineFragmentSelection({
          typeName,
          selectionSet,
        }),
      ],
    },
  };
}

function inlineFragmentSelection({
  typeName,
  selectionSet,
}) {
  return {
    kind: 'InlineFragment',
    typeCondition: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: typeName,
      },
    },
    directives: [],
    selectionSet,
  };
}
