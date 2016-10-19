import {
  Document,
  SelectionSet,
  Definition,
  OperationDefinition,
  Field,
  InlineFragment,
  Directive,
  Selection,
} from 'graphql';

import {
  checkDocument,
} from './getFromAST';

import cloneDeep = require('lodash.clonedeep');

const TYPENAME_FIELD: Field = {
  kind: 'Field',
  alias: null,
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function addTypenameToSelectionSet(
  selectionSet: SelectionSet,
  isRoot = false
) {
  if (selectionSet && selectionSet.selections) {
    if (! isRoot) {
      const alreadyHasThisField = selectionSet.selections.some((selection) => {
        return selection.kind === 'Field' && (selection as Field).name.value === '__typename';
      });

      if (! alreadyHasThisField) {
        selectionSet.selections.push(TYPENAME_FIELD);
      }
    }

    selectionSet.selections =
      selectionSet.selections.filter((sel) => !selectionHasClientDirective(sel));

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
        addTypenameToSelectionSet((selection as Field | InlineFragment).selectionSet);
      }
    });
  }
}

export function addTypenameToDocument(doc: Document) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: Definition) => {
    const isRoot = definition.kind === 'OperationDefinition';
    addTypenameToSelectionSet((definition as OperationDefinition).selectionSet, isRoot);
  });

  return docClone;
}

function selectionHasClientDirective(sel: Selection) {
  return sel.directives && sel.directives.filter((dir: Directive) => {
    return dir.name.value === 'client'
  }).length > 0;
}
