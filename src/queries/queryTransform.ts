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
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function addTypenameToSelectionSet(
  selectionSet: SelectionSetNode,
  isRoot = false,
) {
  if (selectionSet.selections) {
    if (! isRoot) {
      const alreadyHasThisField = selectionSet.selections.some((selection) => {
        return selection.kind === 'Field' && (selection as FieldNode).name.value === '__typename';
      });

      if (! alreadyHasThisField) {
        selectionSet.selections.push(TYPENAME_FIELD);
      }
    }

    selectionSet.selections.forEach((selection) => {
      // Must not add __typename if we're inside an introspection query
      if (selection.kind === 'Field') {
        if (selection.name.value.lastIndexOf('__', 0) !== 0 && selection.selectionSet) {
          addTypenameToSelectionSet(selection.selectionSet);
        }
      } else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          addTypenameToSelectionSet(selection.selectionSet);
        }
      }
    });
  }
}

function removeConnectionDirectiveFromSelectionSet(
  selectionSet: SelectionSetNode,
  isRoot = false,
) {
  if (selectionSet.selections) {
    selectionSet.selections.forEach((selection) => {

      if (selection.kind === 'Field' && selection as FieldNode && selection.directives) {
        selection.directives = selection.directives.filter((directive) => {
          if (directive.arguments) {
            return !directive.arguments.some((arg) => arg.name.value === 'key') && directive.name.value === 'connection';
          } else {
            return false;
          }
        });
      }
    });

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === 'Field') {
        if (selection.selectionSet) {
          removeConnectionDirectiveFromSelectionSet(selection.selectionSet);
        }
      } else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          removeConnectionDirectiveFromSelectionSet(selection.selectionSet);
        }
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

export function removeConnectionDirectiveFromDocument(doc: DocumentNode) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const isRoot = definition.kind === 'OperationDefinition';
    removeConnectionDirectiveFromSelectionSet((definition as OperationDefinitionNode).selectionSet, isRoot);
  });

  return docClone;
}
