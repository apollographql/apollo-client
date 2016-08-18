import {
  OperationDefinition,
  VariableDefinition,
  Name,
  Document,
} from 'graphql';

import { print } from 'graphql-tag/printer';

import {
  SelectionSetWithRoot,
} from './queries/store';

import { FragmentMap } from './queries/getFromAST';

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

// Creates a query document out of the missing selection sets, named fragments, etc.
// in order to print.
export function queryDocument({
  missingSelectionSets,
  variableDefinitions = null,
  name = null,
  fragmentMap,
}: QueryDocumentOptions): Document {

  const doc: Document = {
    kind: 'Document',
    definitions: [],
  };

  const opDefinition = queryDefinition({
    missingSelectionSets,
    variableDefinitions,
    name,
  });

  // add fragments to the query document
  doc.definitions = [opDefinition];
  Object.keys(fragmentMap).forEach((key) => {
    doc.definitions.push(fragmentMap[key]);
  });

  return doc;
}

export function queryDefinition({
    missingSelectionSets,
    variableDefinitions = null,
    name = null,
}: QueryDefinitionOptions): OperationDefinition {
  const selections: any[] = [];

  missingSelectionSets.forEach((missingSelectionSet: SelectionSetWithRoot, ii: any) => {
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

export type QueryDocumentOptions = {
  missingSelectionSets: SelectionSetWithRoot[];
  variableDefinitions?: VariableDefinition[];
  name?: Name;
  fragmentMap: FragmentMap;
}

export type QueryDefinitionOptions = {
  missingSelectionSets: SelectionSetWithRoot[];
  variableDefinitions?: VariableDefinition[];
  name?: Name;
}
