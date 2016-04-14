import {
  print,
  SelectionSet,
  OperationDefinition,
  VariableDefinition,
  Name,
} from 'graphql';

import {
  SelectionSetWithRoot,
} from './queries/store';

export function printQueryForMissingData(options: QueryDefinitionOptions) {
  return printQueryFromDefinition(queryDefinition(options));
}

const idField = {
  kind: 'Field',
  alias: null,
  name: {
    kind: 'Name',
    value: 'id',
  },
};

export function printQueryFromDefinition(queryDef: OperationDefinition) {
  const queryDocumentAst = {
    kind: 'Document',
    definitions: [
      queryDef,
    ],
  };

  return print(queryDocumentAst);
}

export function queryDefinition({
    missingSelectionSets,
    variableDefinitions = null,
    name = null,
}: QueryDefinitionOptions): OperationDefinition {
  const selections = missingSelectionSets.map((missingSelectionSet: SelectionSetWithRoot, ii) => {
    if (missingSelectionSet.id === 'ROOT_QUERY') {
      if (missingSelectionSet.selectionSet.selections.length > 1) {
        throw new Error('Multiple root queries, cannot print that yet.');
      }

      return missingSelectionSet.selectionSet.selections[0];
    }

    return nodeSelection({
      alias: `__node_${ii}`,
      id: missingSelectionSet.id,
      typeName: missingSelectionSet.typeName,
      selectionSet: missingSelectionSet.selectionSet,
    });
  });

  return {
    kind: 'OperationDefinition',
    operation: 'query',
    name,
    variableDefinitions,
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

export type QueryDefinitionOptions = {
  missingSelectionSets: SelectionSetWithRoot[];
  variableDefinitions?: VariableDefinition[];
  name?: Name;
}
