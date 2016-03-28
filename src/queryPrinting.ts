import { print } from 'graphql';
import {
  MissingSelectionSet,
} from './diffAgainstStore';

export function printQueryForMissingData(missingSelectionSets: MissingSelectionSet[]) {
  if (missingSelectionSets.length === 1) {
    const queryDocumentAst = {
      kind: 'Document',
      definitions: [
        nodeQueryDefinition(missingSelectionSets[0]),
      ],
    };

    return print(queryDocumentAst);
  }
}

const idField = {
  kind: 'Field',
  alias: null,
  name: {
    kind: 'Name',
    value: 'id',
  },
};

function nodeQueryDefinition({
  id,
  typeName,
  selectionSet,
}: MissingSelectionSet) {
  return {
    kind: 'OperationDefinition',
    operation: 'query',
    name: null,
    variableDefinitions: null,
    directives: [],
    selectionSet: {
      kind: 'SelectionSet',
      selections: [
        nodeSelection({
          id,
          typeName,
          selectionSet,
        }),
      ],
    },
  };
}

function nodeSelection({
  id,
  typeName,
  selectionSet,
}: MissingSelectionSet) {
  return {
    kind: 'Field',
    alias: null,
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
