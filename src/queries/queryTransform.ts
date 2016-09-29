import {
  Document,
  SelectionSet,
  Definition,
  OperationDefinition,
  FragmentDefinition,
  Field,
  InlineFragment,
} from 'graphql';

import {
  checkDocument,
} from './getFromAST';

import cloneDeep = require('lodash.clonedeep');

// A QueryTransformer takes a SelectionSet and transforms it in someway (in place).
export type QueryTransformer = (selectionSet: SelectionSet) => void

// Adds a field with a given name to every node in the AST recursively.
// Note: this mutates the AST passed in.
export function addFieldToSelectionSet(fieldName: string, selectionSet: SelectionSet) {
  const fieldAst: Field = {
    kind: 'Field',
    alias: null,
    name: {
      kind: 'Name',
      value: fieldName,
    },
  };

  if (selectionSet && selectionSet.selections) {
    let alreadyHasThisField = false;
    selectionSet.selections.forEach((selection) => {
      if (selection.kind === 'Field' && (selection as Field).name.value === fieldName) {
        alreadyHasThisField = true;
      }
    });
    if (! alreadyHasThisField) {
      selectionSet.selections.push(fieldAst);
    }
  }
}

// Adds typename fields to every node in the AST recursively.
// Note: This muates the AST passed in.
export function addTypenameToSelectionSet(selectionSet: SelectionSet) {
  return addFieldToSelectionSet('__typename', selectionSet);
}

function traverseSelectionSet(selectionSet: SelectionSet, queryTransformers: QueryTransformer[], isRoot = false) {

  if (selectionSet && selectionSet.selections) {
    queryTransformers.forEach((transformer) => {
      if (! isRoot) {
        transformer(selectionSet); // transforms in place
      }
      selectionSet.selections.forEach((selection) => {
        if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
          traverseSelectionSet((selection as Field | InlineFragment).selectionSet, queryTransformers);
        }
      });
    });
  }
}
/**
 * Applies transformers to document and returns a new transformed document.
 * @param {Document} doc - A GraphQL document that will be transformed
 * @param {QueryTranformer[]} queryTransformers - transformers to be applied to the document
 * @ return {Document} - a new transformed document
 */
export function applyTransformers(doc: Document, queryTransformers: QueryTransformer[]): Document {
  checkDocument(doc);
  const docClone = cloneDeep(doc);
  docClone.definitions.forEach((definition: Definition) => {
    if (definition.kind === 'OperationDefinition') { // query or mutation
      traverseSelectionSet((definition as OperationDefinition).selectionSet, queryTransformers, true);
    } else {
      traverseSelectionSet((definition as FragmentDefinition).selectionSet, queryTransformers);
    }

  });
  return docClone;
}
