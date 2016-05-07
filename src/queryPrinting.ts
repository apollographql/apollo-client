import {
  OperationDefinition,
  VariableDefinition,
  Name,
} from 'graphql';

import { print } from 'graphql/language/printer';

import {
  SelectionSetWithRoot,
} from './queries/store';

export function printQueryForMissingData(options: QueryDefinitionOptions) {
  return printQueryFromDefinition(queryDefinition(options));
}

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
  const selections = [];

  missingSelectionSets.forEach((missingSelectionSet: SelectionSetWithRoot, ii) => {
    if (missingSelectionSet.id === 'CANNOT_REFETCH') {
      throw new Error('diffAgainstStore did not merge selection sets correctly');
    }

    if (missingSelectionSet.id !== 'ROOT_QUERY') {
      // At some point, put back support for the node interface. Look in the git history for
      // the code that printed node queries here.
      throw new Error('Only root query selections supported.');
    }

    missingSelectionSet.selectionSet.selections.forEach((selection) => {
      selections.push(selection);
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

export type QueryDefinitionOptions = {
  missingSelectionSets: SelectionSetWithRoot[];
  variableDefinitions?: VariableDefinition[];
  name?: Name;
}
