import {
  SelectionSet,
  OperationDefinition,
  Field,
  InlineFragment,
} from 'graphql';

import cloneDeep = require('lodash.clonedeep');

// A QueryTransformer takes a SelectionSet and transforms it in someway (in place).
export type QueryTransformer = (selectionSet: SelectionSet) => void

// Adds a field with a given name to every node in the AST recursively.
// Note: this mutates the AST passed in.
export function addFieldToSelectionSet(fieldName: string, selectionSet: SelectionSet) {
  if (selectionSet == null || selectionSet.selections == null) {
    return selectionSet;
  }

  const fieldAst: Field = {
    kind: 'Field',
    alias: null,
    name: {
      kind: 'Name',
      value: fieldName,
    },
  };

  let alreadyHasThisField = false;
  selectionSet.selections.map((selection) => {
    // We use type assertions to make sure the selection isn't a FragmentSpread because
    // that can't have a selectionSet.
    if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
      addTypenameToSelectionSet((selection as (Field | InlineFragment)).selectionSet);
    }

    if (selection.kind === 'Field' && (selection as Field).name.value === fieldName) {
      alreadyHasThisField = true;
    }
  });

  if (! alreadyHasThisField) {
    // Add the typename to this particular node's children
    selectionSet.selections.push(fieldAst);
  }

  return selectionSet;
}

// Adds typename fields to every node in the AST recursively.
// Note: This muates the AST passed in.
export function addTypenameToSelectionSet(selectionSet: SelectionSet) {
  return addFieldToSelectionSet('__typename', selectionSet);
}

// Add typename field to the root query node (i.e. OperationDefinition). Returns a new
// query tree.
export function addTypenameToQuery(queryDef: OperationDefinition): OperationDefinition {
  const queryClone = cloneDeep(queryDef);
  this.addTypenameToSelectionSet(queryClone.selectionSet);
  return queryClone;
}

// Apply a QueryTranformer to an OperationDefinition (extracted from a query
// or a mutation.)
// Returns a new query tree.
export function applyTransformerToOperation(queryDef: OperationDefinition,
  queryTransformer: QueryTransformer): OperationDefinition {
    const queryClone = cloneDeep(queryDef);
    queryTransformer(queryClone.selectionSet);
    return queryClone;
}
