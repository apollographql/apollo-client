import {
  SelectionSet,
  OperationDefinition,
  Field,
  InlineFragment,
} from 'graphql';

import cloneDeep = require('lodash.clonedeep');

// A QueryTransformer takes a SelectionSet and transforms it in someway (in place) and
// then returns the same SelectionSet.
export type QueryTransformer = (queryPiece: SelectionSet) => SelectionSet

// Adds typename fields to every node in the AST recursively. Returns a copy of the entire
// AST with the typename fields added.
// Note: This muates the AST passed in.
export function addTypenameToSelectionSet(queryPiece: SelectionSet) {
  if (queryPiece == null || queryPiece.selections == null) {
    return queryPiece;
  }

  const typenameFieldAST: Field = {
    kind: 'Field',
    alias: null,
    name: {
      kind: 'Name',
      value: '__typename',
    },
  };

  queryPiece.selections.map((child) => {
    // We use type assertions to make sure the child isn't a FragmentSpread because
    // that can't have a selectionSet.
    if (child.kind === 'Field' || child.kind === 'InlineFragment') {
      addTypenameToSelectionSet((child as (Field | InlineFragment)).selectionSet);
    }
  });

  // Add the typename to this particular node's children
  queryPiece.selections.push(typenameFieldAST);
  return queryPiece;
}

// Add typename field to the root query node (i.e. OperationDefinition). Returns a new
// query tree.
export function addTypenameToQuery(queryDef: OperationDefinition): OperationDefinition {
  const queryClone = cloneDeep(queryDef);
  this.addTypenameToSelectionSet(queryClone.selectionSet);
  return queryClone;
}

// Apply a QueryTranformer to an OperationDefinition (extracted from a query)
// Returns a new query tree.
export function applyTransformerToQuery(queryDef: OperationDefinition,
  queryTransformer: QueryTransformer): OperationDefinition {
    const queryClone = cloneDeep(queryDef);
    queryTransformer(queryClone.selectionSet);
    return queryClone;
}
