import {
  DocumentNode,
  SelectionSetNode,
  DefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  InlineFragmentNode,
} from 'graphql';

import {
  checkDocument,
} from './getFromAST';

import { cloneDeep } from '../util/cloneDeep';

const TYPENAME_FIELD: FieldNode = {
  kind: 'Field',
  alias: null,
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function addTypenameToSelectionSet(
  selectionSet: SelectionSetNode,
  isRoot = false,
) {
  if (selectionSet && selectionSet.selections) {
    if (! isRoot) {
      const alreadyHasThisField = selectionSet.selections.some((selection) => {
        return selection.kind === 'Field' && (selection as FieldNode).name.value === '__typename';
      });

      if (! alreadyHasThisField) {
        selectionSet.selections.push(TYPENAME_FIELD);
      }
    }

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
        addTypenameToSelectionSet((selection as FieldNode | InlineFragmentNode).selectionSet);
      }
    });
  }
}

export function addTypenameToDocument(doc: DocumentNode) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const isRoot = definition.kind === 'OperationDefinition';
    addTypenameToSelectionSet((definition as OperationDefinitionNode).selectionSet, isRoot);
  });

  return docClone;
}
